export interface IContainerInspect {
	Id: string;
	Created: string;
	Path: string;
	Args: string[];
	State: State;
	Image: string;
	ImageDigest: string;
	ImageName: string;
	Rootfs: string;
	Pod: string;
	ResolvConfPath: string;
	HostnamePath: string;
	HostsPath: string;
	StaticDir: string;
	OCIConfigPath: string;
	OCIRuntime: string;
	ConmonPidFile: string;
	PidFile: string;
	Name: string;
	RestartCount: number;
	Driver: string;
	MountLabel: string;
	ProcessLabel: string;
	AppArmorProfile: string;
	EffectiveCaps: string[];
	BoundingCaps: string[];
	ExecIDs: any[];
	GraphDriver: GraphDriver;
	Mounts: Mount[];
	Dependencies: any[];
	NetworkSettings: NetworkSettings;
	Namespace: string;
	IsInfra: boolean;
	IsService: boolean;
	Config: Config;
	HostConfig: HostConfig;
}

interface State {
	OciVersion: string;
	Status: string;
	Running: boolean;
	Paused: boolean;
	Restarting: boolean;
	OOMKilled: boolean;
	Dead: boolean;
	Pid: number;
	ConmonPid: number;
	ExitCode: number;
	Error: string;
	StartedAt: string;
	FinishedAt: string;
	Health: Health;
	CgroupPath: string;
	CheckpointedAt: string;
	RestoredAt: string;
}

interface Health {
	Status: string;
	FailingStreak: number;
	Log: any;
}

interface GraphDriver {
	Name: string;
	Data: any;
}

interface Mount {
	Type: string;
	Source: string;
	Destination: string;
	Driver: string;
	Mode: string;
	Options: string[];
	RW: boolean;
	Propagation: string;
}

interface NetworkSettings {
	EndpointID: string;
	Gateway: string;
	IPAddress: string;
	IPPrefixLen: number;
	IPv6Gateway: string;
	GlobalIPv6Address: string;
	GlobalIPv6PrefixLen: number;
	MacAddress: string;
	Bridge: string;
	SandboxID: string;
	HairpinMode: boolean;
	LinkLocalIPv6Address: string;
	LinkLocalIPv6PrefixLen: number;
	Ports: Record<string, any>;
	SandboxKey: string;
	Networks: Record<string, Network>;
}

interface Network {
	EndpointID: string;
	Gateway: string;
	IPAddress: string;
	IPPrefixLen: number;
	IPv6Gateway: string;
	GlobalIPv6Address: string;
	GlobalIPv6PrefixLen: number;
	MacAddress: string;
	NetworkID: string;
	DriverOpts: any;
	IPAMConfig: any;
	Links: any;
	Aliases: string[];
}

interface Config {
	Hostname: string;
	Domainname: string;
	User: string;
	AttachStdin: boolean;
	AttachStdout: boolean;
	AttachStderr: boolean;
	Tty: boolean;
	OpenStdin: boolean;
	StdinOnce: boolean;
	Env: string[];
	Cmd: string[];
	Image: string;
	Volumes: any;
	WorkingDir: string;
	Entrypoint: string;
	OnBuild: any;
	Labels: Record<string, string>;
	Annotations: Record<string, string>;
	StopSignal: number;
	Healthcheck: {
		Test: string[];
		Interval: number;
		Timeout: number;
		Retries: number;
	};
	HealthcheckOnFailureAction: string;
	CreateCommand: string[];
	Umask: string;
	Timeout: number;
	StopTimeout: number;
	Passwd: boolean;
	sdNotifyMode: string;
}

interface HostConfig {
	Binds: string[];
	CgroupManager: string;
	CgroupMode: string;
	ContainerIDFile: string;
	LogConfig: LogConfig;
	NetworkMode: string;
	PortBindings: PortBindings;
	RestartPolicy: RestartPolicy;
	AutoRemove: boolean;
	VolumeDriver: string;
	VolumesFrom: any;
	CapAdd: any[];
	CapDrop: any[];
	Dns: string[];
	DnsOptions: any[];
	DnsSearch: any[];
	ExtraHosts: any[];
	GroupAdd: any[];
	IpcMode: string;
	Cgroup: string;
	Cgroups: string;
	Links: any;
	OomScoreAdj: number;
	PidMode: string;
	Privileged: boolean;
	PublishAllPorts: boolean;
	ReadonlyRootfs: boolean;
	SecurityOpt: any[];
	Tmpfs: Record<string, string>;
	UTSMode: string;
	UsernsMode: string;
	ShmSize: number;
	Runtime: string;
	ConsoleSize: number[];
	Isolation: string;
	CpuShares: number;
	Memory: number;
	NanoCpus: number;
	CgroupParent: string;
	BlkioWeight: number;
	BlkioWeightDevice: any;
	BlkioDeviceReadBps: any;
	BlkioDeviceWriteBps: any;
	BlkioDeviceReadIOps: any;
	BlkioDeviceWriteIOps: any;
	CpuPeriod: number;
	CpuQuota: number;
	CpuRealtimePeriod: number;
	CpuRealtimeRuntime: number;
	CpusetCpus: string;
	CpusetMems: string;
	Devices: any[];
	DiskQuota: number;
	KernelMemory: number;
	MemoryReservation: number;
	MemorySwap: number;
	MemorySwappiness: number;
	OomKillDisable: boolean;
	PidsLimit: number;
	Ulimits: ULimit[];
	CpuCount: number;
	CpuPercent: number;
	IOMaximumIOps: number;
	IOMaximumBandwidth: number;
	CgroupConf: any;
}

interface LogConfig {
	Type: string;
	Config: any;
	Path: string;
	Tag: string;
	Size: string;
}

interface PortBindings {}

interface RestartPolicy {
	Name: string;
	MaximumRetryCount: number;
}

interface ULimit {
	Name: string;
	Soft: number;
	Hard: number;
}
