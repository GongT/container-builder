export interface IImageInspect {
	Id: string;
	Digest: string;
	RepoTags: string[];
	RepoDigests: string[];
	Parent: string;
	Comment: string;
	Created: string;
	Config: Config;
	Version: string;
	Author: string;
	Architecture: string;
	Os: string;
	Size: number;
	VirtualSize: number;
	GraphDriver: GraphDriver;
	RootFS: RootFs;
	Labels: Record<string, string>;
	Annotations: Record<string, string>;
	ManifestType: string;
	User: string;
	History: History[];
	NamesHistory: string[];
}

interface Config {
	Env: string[];
	Cmd: string[];
	Labels: Record<string, string>;
	StopSignal: string;
}

interface GraphDriver {
	Name: string;
	Data: any;
}

interface RootFs {
	Type: string;
	Layers: string[];
}

interface History {
	created: string;
	comment?: string;
	created_by?: string;
	empty_layer?: boolean;
	author?: string;
}
