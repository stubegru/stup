export interface StupConfig {
    projects: StupProjectList;
}

export interface StupProjectList {
    [index: string]: StupProject;
}

export enum StupProjectType {
    stubegru = "stubegru",
    git_repo = "git_repo"
}

export interface StupProject {
    id: string;
    path: string;
    type: StupProjectType;
    targets: TargetList;
}

export interface TargetList {
    [index: string]: Target;
}

export interface Target {
    id: string;
    description: string;
    customBranch: string;
    tag: string;
    ssh: SSHConfig;
    preHash?: string;
    postHash?: string;
    protected: boolean;
}

export interface SSHConfig {
    url: string;
    user: string;
    key: string;
}

export interface CliParams {
    projectId: string;
    targetId: string;
    yes: boolean;
}

export interface deployOptions {
    yes: boolean;
}

export class Repo {
    name: string;
    path: string;
    target: Target;

    constructor(name: string, project: StupProject, target: Target, relativePath: string = "") {
        this.name = name;
        this.path = project.path + relativePath;
        let targetCopy = JSON.parse(JSON.stringify(target)) as Target;
        targetCopy.ssh.url += relativePath;
        this.target = targetCopy;
    }
}

export interface SqlConnection{
    host:string;
    user:string;
    password:string;
    name:string;
}