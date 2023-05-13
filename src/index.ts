import { Repo } from "./interfaces.js";
import * as stup from "./utils.js";

let config = stup.parseConfig();
stup.sayHello();

const target = await stup.getCurrentTarget(config);
const stubegruRepo = new Repo("stubegru", config, target);
const customRepo = new Repo("custom-folder", config, target, "/custom");

await stup.repoClean(stubegruRepo);
await stup.checkCustomBranch(customRepo);
await stup.repoClean(customRepo);
await stup.loadSSHKey(target);
await stup.updateVersionFile(stubegruRepo);

await stup.gitFtp(stubegruRepo);
await stup.gitFtp(customRepo);

await stup.listCommits([stubegruRepo, customRepo]);
await stup.updateGitTag(stubegruRepo);
await stup.updateGitTag(customRepo);

stup.quit();






