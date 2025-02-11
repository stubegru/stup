import { exec, spawn } from "node:child_process";
import { SqlConnection } from "./interfaces.js";

export async function generateSqlDump(sourceDb: SqlConnection): Promise<string> {

    let cmd = `mysqldump --user=${sourceDb.user} --password=${sourceDb.password} --host=${sourceDb.host} --compact ${sourceDb.name}`;
    let dump = await execShellCommand(cmd);
    return dump;

}

export async function applySqlDump(targetDb: SqlConnection, dump:string) {

    let cmd = `mysql --user=${targetDb.user} --password=${targetDb.password} --host=${targetDb.host} ${targetDb.name}`;
    const child = spawn(cmd);

    child.stdout.on('data', (data) => {
        console.log(`stdout:\n${data}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    child.on('error', (error) => {
        console.error(`error: ${error.message}`);
    });

    child.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });

    child.stdin.write(dump);


}








const sourceDb = {
    name: "stup-test-local",
    host: "localhost",
    password: "test",
    user: "test"
};
const targetDb = {
    name: "stup-test-remote",
    host: "localhost",
    password: "test",
    user: "test"
};


export async function mirrorDb(source:SqlConnection, target:SqlConnection){
    let dump = await generateSqlDump(source);
    applySqlDump(target,dump);
}

mirrorDb(sourceDb,targetDb);





/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
export function execShellCommand(cmd):Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
                reject(error);
            }
            stdout ? resolve(stdout) : reject(stderr);
        });
    });
}


