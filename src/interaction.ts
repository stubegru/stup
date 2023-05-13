import inquirer from 'inquirer';
import { TargetList } from './interfaces.js';

export function start(targets: TargetList) {

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