export interface StupConfig {
    stubegruPath: string;
    targets: TargetList;
}

export interface TargetList{
    [index: string]: Target;
}

export interface Target {
    id:string;
    description: string;
    customBranch: string;
    tag: string;
    ssh: SSHConfig;
}

export interface SSHConfig {
    url: string;
    user: string;
    key: string;
}

export class Repo{
    name:string;
    path:string;
    target:Target;

    constructor(name:string,config:StupConfig,target:Target,relativePath:string=""){
        this.name = name;
        this.path = config.stubegruPath + relativePath;
        let targetCopy = JSON.parse(JSON.stringify(target)) as Target;
        targetCopy.ssh.url += relativePath;
        this.target = targetCopy;
    }
}