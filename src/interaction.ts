import inquirer from 'inquirer';
import { StupProjectList, TargetList } from './interfaces.js';

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