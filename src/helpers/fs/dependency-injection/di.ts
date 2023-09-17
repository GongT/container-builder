import {
	DeferredPromise,
	KnownError,
	definePublicConstant,
	registerGlobalLifecycle,
	toDisposable,
} from '@idlebox/common';
import 'reflect-metadata';
import { attachInspect } from '../../functions/attachInspect';

type CanInit<T, TArg extends any[]> = {
	init(...props: TArg): void | T | Promise<void | Partial<T>>;
};
type CanNotInit<T> = T & { init: never }; // Omit<T, 'init'>;
type InstanceOf<T, TArg extends any[]> = T | (T & CanInit<T, TArg>);
export type ConstructorOf<T, TArg extends any[]> = new () => InstanceOf<T, TArg>;

interface IPropDefine {
	readonly token: IDependencyToken;
	readonly required: boolean;
	readonly propKey: string | symbol;
}
type IPending = Map<IDependencyToken, IPropDefine>;

interface IStateWait {
	readonly instance: InstanceOf<any, any>;
	readonly fullfilled: false;
	readonly props: IPending;
	readonly dfd: DeferredPromise<any>;
}
interface IStateComplete {
	readonly instance: InstanceOf<any, any>;
	readonly fullfilled: true;
}
type IState = IStateComplete | IStateWait;

const container = new Map<IDependencyToken, ConstructorOf<any, any>>();
const instanceRegistry = new WeakMap<IDependencyToken, IState>();
const tokens = new Map<string, IDependencyToken>();

const injectMetaKey = Symbol('inject metadata key');

registerGlobalLifecycle(
	toDisposable(() => {
		for (const token of tokens.values()) {
			const state = instanceRegistry.get(token);
			if (!state) continue;
			if (!state.fullfilled) {
				// console.error('[DI] \x1B[38;5;9mservice not fullfilled\x1B[0m:', token.toString());
				process.exitCode = 1;
			}
		}
	})
);

function _$(token: symbol | string | IDependencyToken) {
	if (typeof token === 'string') return token;
	return token.toString().replace(/^Symbol\(|\)$/g, '');
}

type ArgTypeOf<T> = TokenTypeOf<T>['__args'];
export type TokenTypeOf<TIns extends InstanceOf<any, any[]>> = IDependencyToken<
	TIns,
	TIns extends CanInit<any, any> ? Parameters<TIns['init']> : []
>;

export class DependencyError extends KnownError {
	private readonly _stack?: string;

	constructor(message: string, stack?: string, deleteFirst: boolean = true) {
		super(message);
		if (stack === undefined) stack = super.stack || '';
		if (deleteFirst) {
			this._stack = stack.slice(stack.indexOf('\n'));
		} else {
			this._stack = stack;
		}
		this.stack = this.message + stack;
	}

	static wrap(e: Error, message?: string) {
		const msg = message ? message + ': ' + e.message : e.message;
		if (e instanceof DependencyError) {
			return new DependencyError(msg, e._stack, false);
		} else {
			return new DependencyError(msg, e.stack || '');
		}
	}
	static wrapThrow(e: Error, message?: string): never {
		throw DependencyError.wrap(e, message);
	}
}

export function registerAuto(): ClassDecorator {
	return (target: any) => {
		// console.error('[DI] register: %s', target.name);
		const token = tokens.get('I' + target.name);
		attachInspect(target);
		if (!token) throw new DependencyError(`can't auto register dependency, unknown class: ${target.name}`);
		container.set(token, target);
	};
}

export function createToken<T extends InstanceOf<any, any[]>>(tk: string): TokenTypeOf<T> {
	// console.error('[DI] new token: %s', tk);
	const token: TokenTypeOf<T> = Symbol(tk) as any;
	tokens.set(tk, token);
	return token;
}

export interface IDependencyToken<T = any, TArg extends any[] = any> {
	__brand: T;
	__args: TArg;
	toString(): string;
}

type MaybePromise<T> = T | Promise<T>;

function getCreateService<T>(paths: string[], token: IDependencyToken<T>) {
	const exists = instanceRegistry.get(token);
	if (exists) return exists;

	const tokenStr = token.toString();
	paths = [...paths, tokenStr];

	const Class = container.get(token);
	// console.error('[DI]\x1B[38;5;14mCREATE %s = %s\x1B[0m', paths.join(' -> '), Class?.name);
	if (!Class) throw new DependencyError('missing dependency: ' + tokenStr);
	const instance = new Class();
	const dfd = new DeferredPromise<void>();

	let state: IState = {
		fullfilled: false,
		instance,
		dfd,
		props: getSuperChain(Class),
	};

	// console.error('[DI]  -> init=%s, props=%s', !!instance.init, [...state.props.keys()]);

	const finalize = () => {
		// console.error('[DI] <%s> finalize!', token.toString());
		state = {
			fullfilled: true,
			instance: state.instance,
		};
		instanceRegistry.set(token, state);
	};
	if (state.props.size === 0 && !instance.init) {
		finalize();
	} else {
		instanceRegistry.set(token, state);
		createProps(token, state, paths)
			.then(() => {
				return initInstance(token, state, []);
			})
			.then(finalize)
			.catch((e) => {
				if (state.fullfilled) {
					throw e;
				} else {
					state.dfd.error(e);
				}
			});
	}

	return state;
}

async function initInstance(token: IDependencyToken<any, any>, state: IState, props: any[]) {
	// console.error('[DI] <%s> finalize:', token.toString());
	if (state.fullfilled) throw new DependencyError('duplicate finalize: ' + token.toString());

	if (state.instance.init) {
		try {
			const apply = await state.instance.init(...props);
			Object.assign(state.instance, apply);
		} catch (e: any) {
			// console.error('[DI]\t<%s> init failed', token.toString());
			state.dfd!.error(DependencyError.wrap(e, `can not initialize service "${_$(token)}"`));
			return;
		}
	}

	state.dfd!.complete(state.instance);
}

function createProps(token: IDependencyToken, state: IState, paths: string[]) {
	if (state.fullfilled) throw new DependencyError('duplicate finalize: ' + token.toString());

	const ps = [];
	for (const { token: propToken, required, propKey } of state.props.values()) {
		const propState = getCreateService(paths, propToken);
		// console.error(
		// 	'[DI] <%s>     property: %s = %s (required=%s, fullfilled=%s)',
		// 	token.toString(),
		// 	propKey,
		// 	propToken.toString(),
		// 	required,
		// 	propState.fullfilled
		// );
		definePublicConstant(state.instance, propKey, propState.instance);
		if (!propState.fullfilled && required) {
			ps.push(
				propState.dfd.p.catch((e) => {
					DependencyError.wrapThrow(e, `failed inject property "${_$(propKey)}" on "${_$(token)}"`);
				})
			);
		}
	}

	// console.error('[DI] <%s> createProps: waitting %s items', token.toString(), state.props.size);
	return Promise.all(ps).then(() => {
		// console.error('[DI] <%s> createProps finished', token.toString());
	});
}

export function resolveService<T>(token: IDependencyToken<T>): MaybePromise<CanNotInit<T>> {
	if (!token) throw new DependencyError('invalid token (likely circular import)');

	const state = getCreateService<T>([], token);

	return state.fullfilled ? state.instance : state.dfd.p.catch(DependencyError.wrapThrow);
}

export async function createInstance<T>(token: TokenTypeOf<T>, ...props: ArgTypeOf<T>): Promise<T> {
	const Class = container.get(token);
	if (!Class) throw new DependencyError('missing dependency: ' + token.toString());
	const instance = new Class();
	const dfd = new DeferredPromise<void>();

	const state = {
		fullfilled: false,
		instance,
		dfd,
		props: getSuperChain(Class),
	};

	if (state.props.size !== 0) {
		await createProps(token, state, []);
	}
	await initInstance(token, state, props);

	return state.instance;
}

type IMeta = IPropDefine[];
interface InjectDecorator extends PropertyDecorator {
	optional(): PropertyDecorator;
}
export function inject<T>(token: TokenTypeOf<T>, ...args: ArgTypeOf<T>): InjectDecorator {
	if (args.some((e: any) => e !== undefined)) throw new DependencyError('not impl: inject with args');

	if (!token) throw new DependencyError('invalid token (likely circular dependency)');
	const inject = (target: any, propKey: string | symbol, required: boolean) => {
		if (!Reflect.hasOwnMetadata(injectMetaKey, target)) {
			Reflect.defineMetadata(injectMetaKey, [], target);
		}
		const r: IMeta = Reflect.getOwnMetadata(injectMetaKey, target);
		// console.log('[DI]    meta:', r);
		r.push({ propKey, token, required });
	};
	function create(required: boolean) {
		return (target: any, propKey: string | symbol) => inject(target, propKey, required);
	}
	return Object.assign(create(true), {
		optional() {
			return create(false);
		},
	});
}

function getSuperChain(Class: ConstructorOf<any, any>) {
	let properties: IPending = new Map();
	let object = Class as any;
	do {
		if (!object.prototype) {
			// console.log('[DI]    get meta: root?', object);
			break;
		}
		const r: IMeta = Reflect.getOwnMetadata(injectMetaKey, object.prototype);
		// console.log('[DI]    get meta:', object.name, r);
		if (r) {
			for (const property of Object.values(r)) {
				properties.set(property.token, property);
			}
		}
		object = Object.getPrototypeOf(object);
	} while (object.constructor !== Object);
	return properties;
}
