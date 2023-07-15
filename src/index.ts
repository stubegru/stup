import chalk from "chalk";
import { Repo, StupProjectType } from "./interfaces.js";
import { parseCliParams } from "./userInterface.js";
import * as stup from "./utils.js";

let cliParams = parseCliParams();
let config = stup.parseConfig();
stup.sayHello();

const project = await stup.getCurrentProject(config, cliParams.projectId);
const target = await stup.getCurrentTarget(project, cliParams.targetId);
console.log(`🔵 Deploy project ${chalk.blueBright(project.id)} to target ${chalk.blueBright(target.id)}`);

switch (project.type) {
    case StupProjectType.stubegru:
        await stup.deployStubegru(project, target, cliParams);
        break;
    case StupProjectType.git_repo:
        await stup.deployGitRepo(project, target, cliParams);
        break;
    default: console.error(`Invalid projectType ${project.type} for project ${project.id}!`);
        break;

}

stup.quit();






