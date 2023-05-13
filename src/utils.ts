import * as bash from './bash.js';
import * as cli from './interaction.js';
import { Repo, StupConfig, StupProject, Target } from './interfaces.js';

import ora from 'ora';
import { readFileSync } from 'fs';
import * as url from 'url';
import chalk from 'chalk';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)); //legacy support for __dirname

export function parseConfig(): StupConfig {
    return JSON.parse(readFileSync(`${__dirname}/../stup_config.json`).toString("utf8"));
}

export function sayHello() {
    console.log(`[${new Date().toLocaleString()}] Starting Stup deployment via SSH`);
}

export async function repoClean(repo: Repo) {
    bash.send(`cd ${repo.path}`);
    bash.send(`git status --porcelain && echo ">>>EOE<<<"`);
    let cleanCheck = await bash.bashResponse();
    if (cleanCheck != ">>>EOE<<<") {
        console.error(`🔴 The ${chalk.bold(repo.name)} repository is not clean. Please commit all changes before deploying!`);
        console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
        process.exit(1);
    }
    console.log(`🟢 ${repo.name} repository is clean`);
}

export async function getCurrentTarget(project: StupProject) {
    const cliAnswers = await cli.askForTarget(project.targets);
    const targetId = cliAnswers.targetId;
    const t: Target = project.targets[targetId];
    t.id = targetId;
    return t;
}

export async function getCurrentProject(config: StupConfig) {
    const cliAnswers = await cli.askForProject(config.projects);
    const projectId = cliAnswers.projectId;
    const p: StupProject = config.projects[projectId];
    p.id = projectId;
    return p;
}

export async function checkCustomBranch(repo: Repo) {
    bash.send(`cd ${repo.path}`);
    bash.send("git rev-parse --abbrev-ref HEAD")
    let actualBranch = await bash.bashResponse();
    if (actualBranch != repo.target.customBranch) {
        console.error(`🔴 ${chalk.blueBright(repo.name)} is currently on branch ${chalk.blueBright(actualBranch)}, but target wants branch ${chalk.blueBright(repo.target.customBranch)}`);
        console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
        process.exit(1);
    }
    console.log(`🟢 ${chalk.blueBright(repo.name)} is on branch ${chalk.blueBright(actualBranch)}`);
}

export async function loadSSHKey(t: Target) {
    let spinner = ora('Load ssh private key').start();
    bash.send("eval `ssh-agent`");
    bash.send(`ssh-add ${t.ssh.key}`);
    await bash.bashResponse(new RegExp("Identity added"));
    spinner.stop();
    console.log(`🟢 Loaded private key ${chalk.blueBright(t.ssh.key)}`);
}

export async function updateVersionFile(repo: Repo) {
    bash.send(`cd ${repo.path}`);
    bash.send("git rev-parse --short HEAD");
    let versionHash = await bash.bashResponse();
    bash.send(`echo -n "${versionHash}" > .version`);
    console.log(`🟢 Updating .version file for ${chalk.blueBright(repo.name)} to ${chalk.blueBright(versionHash)}`);
    return versionHash;
}

export async function gitFtp(repo: Repo) {
    let spinner = ora(`Upload files using git-ftp for repo ${chalk.blueBright(repo.name)}`).start();
    bash.send(`cd ${repo.path}`);
    bash.send(`git-ftp push --user ${repo.target.ssh.user} --key "${repo.target.ssh.key}" "${repo.target.ssh.url}"`);

    let gitFtpFirstLine = await bash.bashResponse() as string;

    //check if really upload or everything up to date
    if (new RegExp("Everything up-to-date").test(gitFtpFirstLine)) {
        spinner.stop();
        console.log(`🟡 Files for Repo ${chalk.yellow(repo.name)} are already up-to-date. Uploaded no files here`);
        return;
    }

    //check if some error occurred
    if (new RegExp("The resource does not exist").test(gitFtpFirstLine)) {
        spinner.stop();
        console.error(`🔵 git-ftp seems to be not initialized for repo ${chalk.blueBright(repo.name)}`);
        console.error(`🔵 You could init git-ftp for this repo with:`);
        console.error(`       ${chalk.gray(`cd ${repo.path}`)}`);
        console.error(`       ${chalk.gray(`git-ftp init --user ${repo.target.ssh.user} --key "${repo.target.ssh.key}" "${repo.target.ssh.url}"`)}`);
    }

    //check if some error occurred
    if (new RegExp("fatal").test(gitFtpFirstLine)) {
        spinner.stop();
        console.error(`🔴 git-ftp run into an fatal error on repo ${chalk.redBright(repo.name)}`);
        console.error(gitFtpFirstLine);
        console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
        process.exit(1);
    }

    //count number of files
    let fileCount = gitFtpFirstLine.substring(0, gitFtpFirstLine.indexOf(" "));
    spinner.start(`Upload ${chalk.greenBright(fileCount)} files from ${chalk.blueBright(repo.name)} Repo using git-ftp`);

    let gitFtpResponseLines = await bash.bashResponse(new RegExp("Last deployment changed from"), true);
    //console.log(gitFtpResponse);
    spinner.stop();
    console.log(`🟢 Uploaded ${chalk.blueBright(fileCount)} files from ${chalk.blueBright(repo.name)} Repo, git-ftp said:`);
    for (const msg of gitFtpResponseLines) {
        console.log(`  ${chalk.gray(msg)}`);
    }
}

export async function listCommits(repoList: Repo[]) {
    let storage = [];
    for (const repo of repoList) {
        bash.send(`cd ${repo.path}`);
        bash.send(`git log --pretty=format:%s ${repo.target.tag}..HEAD && echo ">>> No commits found for ${chalk.blueBright(repo.name)} <<<"`); //echo some random text to prevent getting no response for empty commit list
        let commits = await bash.bashResponse() as string;
        let commitList = commits.split("\n");
        storage.push({ repo: repo, list: commitList });
    }

    console.log(`🟢 Updated changes made by these commits:`);
    for (const sto of storage) {
        for (const c of sto.list) {
            console.log(`  - [${sto.repo.name}] ${chalk.gray(c)}`);
        }
    }
}

export async function updateGitTag(repo: Repo) {
    bash.send(`cd ${repo.path}`);
    bash.send(`git tag -d ${repo.target.tag}`); //remove tag (from last commit)
    bash.send(`git tag ${repo.target.tag}`); //reassign tag (to latest commit)
    bash.send("git rev-parse --short HEAD");
    let commitHash = await bash.bashResponse();
    console.log(`🟢 Added git-tag ${chalk.blueBright(repo.target.tag)} to current commit ${chalk.blueBright(commitHash)} in ${chalk.blueBright(repo.name)} Repo`);
}

export function quit() {
    bash.send(`ssh-agent -k`); //close ssh-agent
    console.log(`✅ ${chalk.greenBright("Deployment was successful")}`);
    bash.end();
}

export async function deployStubegru(project: StupProject) {
    const target = await this.getCurrentTarget(project);
    const mainRepo = new Repo("stubegru", project, target);
    const customRepo = new Repo("custom-folder", project, target, "/custom");

    await this.repoClean(mainRepo);
    await this.checkCustomBranch(customRepo);
    await this.repoClean(customRepo);
    await this.loadSSHKey(target);
    await this.updateVersionFile(mainRepo);

    await this.gitFtp(mainRepo);
    await this.gitFtp(customRepo);

    await this.listCommits([mainRepo, customRepo]);
    await this.updateGitTag(mainRepo);
    await this.updateGitTag(customRepo);
}

export async function deployGitRepo(project: StupProject) {
    const target = await this.getCurrentTarget(project);
    const mainRepo = new Repo(project.id, project, target);

    await this.repoClean(mainRepo);
    await this.loadSSHKey(target);
    await this.gitFtp(mainRepo);
    await this.listCommits([mainRepo]);
    await this.updateGitTag(mainRepo);
}

