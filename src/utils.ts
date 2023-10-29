import * as bash from './bash.js';
import * as cli from './userInterface.js';
import { Repo, StupConfig, StupProject, Target, deployOptions } from './interfaces.js';

import ora from 'ora';
import { readFileSync } from 'fs';
import * as url from 'url';
import chalk from 'chalk';
import { log } from 'console';
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

export async function getCurrentTarget(project: StupProject, targetId?: string) {
    targetId = targetId || (await cli.askForTarget(project.targets)).targetId;
    const t: Target = project.targets[targetId];
    if (!t) {
        console.error(`🔴 Could not find target with id ${chalk.blueBright(targetId)} for project ${chalk.blueBright(project.id)}`);
        console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
        process.exit(1);
    }
    t.id = targetId;
    return t;
}

export async function getCurrentProject(config: StupConfig, projectId?: string) {
    projectId = projectId || (await cli.askForProject(config.projects)).projectId;
    const p: StupProject = config.projects[projectId];
    if (!p) {
        console.error(`🔴 Could not find project with id ${chalk.blueBright(projectId)}`);
        console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
        process.exit(1);
    }
    p.id = projectId;
    return p;
}

/**
 * Check if the repo's branch is the default branch (main or master). Warn if not.
 * @param repo The repo to check
 */
export async function checkMainBranch(repo: Repo) {
    bash.send(`cd ${repo.path}`);
    bash.send("git rev-parse --abbrev-ref HEAD");
    let actualBranch = await bash.bashResponse();
    if (actualBranch != "main" && actualBranch != "master") {
        if (await cli.askForYesNo(`You are deploying the branch ${chalk.blueBright(actualBranch)}, this is ${chalk.yellowBright("not main/master")}. Are you sure?`) == false) {
            console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
            process.exit(1);
        }
    }
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

export async function initGitFtp(repo: Repo) {
    let spinner = ora(`Initialize git-ftp for repo ${chalk.blueBright(repo.name)}`).start();
    bash.send(`cd ${repo.path}`);
    bash.send(`git-ftp init --user ${repo.target.ssh.user} --key "${repo.target.ssh.key}" "${repo.target.ssh.url}"`);

    let gitFtpFirstLine = await bash.bashResponse() as string;

    //check if some error occurred
    if (new RegExp("fatal").test(gitFtpFirstLine)) {
        spinner.stop();
        console.error(`🔴 git-ftp init run into an fatal error on repo ${chalk.redBright(repo.name)}:`);
        console.error("     " + gitFtpFirstLine);
        console.error(`🔴 Are you sure the remote folder exists at ${chalk.redBright(repo.target.ssh.url)}?`);
        console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
        process.exit(1);
    }

    //count number of files
    let fileCount = gitFtpFirstLine.substring(0, gitFtpFirstLine.indexOf(" "));
    spinner.start(`Upload ${chalk.greenBright(fileCount)} files from ${chalk.blueBright(repo.name)} Repo using git-ftp`);

    let gitFtpResponseLines = await bash.bashResponse(new RegExp("Last deployment changed from"), true);
    spinner.stop();
    console.log(`🟢 Initialized ${chalk.blueBright(repo.name)} Repo with ${chalk.blueBright(fileCount)} files, git-ftp said:`);
    for (const msg of gitFtpResponseLines) {
        console.log(`  ${chalk.gray(msg)}`);
    }
}

export async function checkForProtection(repo: Repo) {
    if (repo.target.protected) {
        if (await cli.askForYesNo(`This target is protected. Are you sure?`) == false) {
            console.error(`❌ ${chalk.redBright("Deployment Canceled!")}`);
            process.exit(1);
        }
    }
}

export async function gitFtp(repo: Repo, options: deployOptions) {
    let spinner = ora(`Checking deployed version on target ${chalk.blueBright(repo.target.id)}`).start();
    bash.send(`cd ${repo.path}`);
    bash.send(`git-ftp push --user ${repo.target.ssh.user} --key "${repo.target.ssh.key}" "${repo.target.ssh.url}"`);

    let gitFtpFirstLine = await bash.bashResponse() as string;

    //check if an upload is necessary or remote is already up to date
    if (new RegExp("Everything up-to-date").test(gitFtpFirstLine)) {
        spinner.stop();
        console.log(`🟡 Files for Repo ${chalk.yellow(repo.name)} are already up-to-date. Uploaded no files here`);
        return;
    }

    //check if target is not yet initialized
    if (new RegExp("The resource does not exist").test(gitFtpFirstLine)) {
        spinner.stop();
        console.error(`🔵 git-ftp seems to be not initialized for repo ${chalk.blueBright(repo.name)}`);
        let msg = `Would you like to initialize this repo on target ${chalk.blueBright(repo.target.id)}?`;
        if (options.yes || await cli.askForYesNo(msg)) {
            await initGitFtp(repo);
            return;
        }
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

    //fetch git-ftp output
    let gitFtpResponseLines = await bash.bashResponse(new RegExp("Last deployment changed from"), true);

    //announce success
    spinner.stop();
    console.log(`🟢 Uploaded ${chalk.blueBright(fileCount)} files from ${chalk.blueBright(repo.name)} Repo, git-ftp said:`);
    for (const msg of gitFtpResponseLines) { console.log(`  ${chalk.gray(msg)}`); }

    //filter for commit hashes
    //sample line: "Last deployment changed from ### to ###."
    let hashLine = gitFtpResponseLines[gitFtpResponseLines.length - 1];
    let words = hashLine.split(" ");
    let preHash = words[4];
    let postHash = words[6];
    postHash = postHash.substring(0, postHash.length - 1); //remove last character, its a useless dot
    repo.target.preHash = preHash;
    repo.target.postHash = postHash;

}

export async function listCommits(repoList: Repo[]): Promise<string[]> {

    interface StorageItem { repo: Repo; list: string[]; }

    let storage: StorageItem[] = [];
    let stupHints: string[] = [];

    for (const repo of repoList) {
        if (!repo.target.preHash || !repo.target.postHash) {
            console.log(`🟡 Could not retrieve commits for Repo ${chalk.yellow(repo.name)}.`);
            continue;
        }

        bash.send(`cd ${repo.path}`);
        bash.send(`git log --pretty=format:%s§§§%h ${repo.target.preHash}..${repo.target.postHash}`);
        let commits = await bash.bashResponse() as string;

        let commitList = commits.split("\n");
        storage.push({ repo: repo, list: commitList });
    }

    if (storage.length > 0) {
        console.log(`🟢 Updated changes made by these commits:`);
        for (const sto of storage) {
            for (const line of sto.list) {
                //split commit message and commit id/hash
                //data is stored as commitMessage§§§commitHash
                let commitMessage = line.substring(0,line.indexOf("§§§"));
                let commitHash = line.substring(line.indexOf("§§§")+3);

                //filter stup hints
                let start = commitMessage.indexOf("[stup|");
                let end = commitMessage.indexOf("]");
                if (start != -1 && end != -1) {
                    let msg = commitMessage.substring(start + 6, end);
                    stupHints.push(msg);
                }

                //write line to console
                console.log(`  - [${sto.repo.name}] ${chalk.gray(commitMessage)} #${commitHash}`);
            }
        }
    }

    return stupHints;
}

export async function updateGitTag(repo: Repo) {
    bash.send(`cd ${repo.path}`);
    bash.send(`git tag -d ${repo.target.tag}`); //remove tag (from last commit)
    bash.send(`git tag ${repo.target.tag}`); //reassign tag (to latest commit)
    console.log(`🟢 Added git-tag ${chalk.blueBright(repo.target.tag)} to current commit in ${chalk.blueBright(repo.name)} Repo`);
}

export function quit() {
    bash.send(`ssh-agent -k`); //close ssh-agent
    console.log(`✅ ${chalk.greenBright("Deployment was successful")}`);
    bash.end();
}

export function listHints(hints: string[]) {
    for (const hint of hints) {
        console.log(`🔵 [STUP HINT] ${chalk.bgWhite(chalk.black(hint))}`);
    }
}

export async function deployStubegru(project: StupProject, target: Target, options: deployOptions) {
    const mainRepo = new Repo("stubegru", project, target);
    const customRepo = new Repo("custom-folder", project, target, "/custom");

    await repoClean(mainRepo);
    await checkMainBranch(mainRepo);
    await checkCustomBranch(customRepo);
    await repoClean(customRepo);
    if (!options.yes) { await checkForProtection(mainRepo) };

    await loadSSHKey(target);
    await updateVersionFile(mainRepo);

    await gitFtp(mainRepo, options);
    await gitFtp(customRepo, options);

    let hints = await listCommits([mainRepo, customRepo]);
    await updateGitTag(mainRepo);
    await updateGitTag(customRepo);
    listHints(hints);
}

export async function deployGitRepo(project: StupProject, target: Target, options: deployOptions) {
    const mainRepo = new Repo(project.id, project, target);

    await repoClean(mainRepo);
    await checkMainBranch(mainRepo);
    if (!options.yes) { await checkForProtection(mainRepo) };

    await loadSSHKey(target);
    await gitFtp(mainRepo, options);
    let hints = await listCommits([mainRepo]);
    await updateGitTag(mainRepo);
    listHints(hints);
}

