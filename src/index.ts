import { Repo, StupProjectType } from "./interfaces.js";
import * as stup from "./utils.js";

let config = stup.parseConfig();
stup.sayHello();
const project = await stup.getCurrentProject(config);

switch (project.type) {
    case StupProjectType.stubegru:
        await stup.deployStubegru(project);
        break;
    case StupProjectType.git_repo:
        await stup.deployGitRepo(project);
        break;
    default: console.error(`Invalid projectType ${project.type} for project ${project.id}!`);
        break;

}

stup.quit();






