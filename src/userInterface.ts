import inquirer from 'inquirer';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { CliParams, StupProjectList, TargetList } from './interfaces.js';


export function parseCliParams(): CliParams {
    let cliParams = yargs(hideBin(process.argv)).argv;
    let options: CliParams = { projectId: undefined, targetId: undefined, yes: false };
    options.projectId = cliParams["p"] || cliParams["project"];
    options.targetId = cliParams["t"] || cliParams["target"];
    options.yes = cliParams["y"] || cliParams["yes"];
    return options;
}

export function askForTarget(targets: TargetList) {

    let targetIds = [];
    for (const targetId in targets) { targetIds.push(targetId); }

    const questions = [
        {
            type: 'list',
            name: 'targetId',
            message: 'Which target to deploy?',
            choices: targetIds,
        }
    ]

    return inquirer.prompt(questions)

}

export function askForProject(projects: StupProjectList) {

    let projectIds = [];
    for (const projectId in projects) { projectIds.push(projectId); }

    const questions = [
        {
            type: 'list',
            name: 'projectId',
            message: 'Which project to deploy?',
            choices: projectIds,
        }
    ]

    return inquirer.prompt(questions)

}

export async function askForYesNo(msg) {
    const questions = [
        {
            type: 'confirm',
            name: 'confirm',
            message: msg,
        }
    ]

    let result = await inquirer.prompt(questions);
    return result.confirm;
}