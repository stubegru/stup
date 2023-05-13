import * as child_process from 'child_process';

const VERBOSE = false;
let bashPromise;
let collector = [];
const bashProcess = child_process.spawn('bash');


function handleBashBuffer(dataBuffer) {
    let dataString: string = dataBuffer.toString("utf8");
    dataString = dataString.substring(0, dataString.length - 1); //remove \n at the end

    if (bashPromise) {
        if (bashPromise.regex.test(dataString)) {
            if (bashPromise.collect) {
                collector.push(dataString);
                bashPromise.resolve(collector)
            } else {
                bashPromise.resolve(dataString);
            }
            bashPromise = undefined;
            collector = [];
        }
        else {
            if (bashPromise.collect) {
                collector.push(dataString);
            } else
                if (VERBOSE) { console.log(`\nDont resolve bash Promise [${dataString}]`) };
        }
    }
    else {
        if (VERBOSE) { console.log(`stdout: ${dataBuffer}`) };
    }
}

bashProcess.stdout.on('data', handleBashBuffer);
bashProcess.stderr.on('data', handleBashBuffer);
bashProcess.on('close', (code) => {
    if (VERBOSE) { console.log(`child process exited with code ${code}`); }
});

export function bashResponse(regex?: RegExp, collect?: boolean): Promise<String|String[]> {
    regex = regex || new RegExp("[\s\S]*"); //match anything
    return new Promise((resolve, reject) => {
        bashPromise = { resolve: resolve, reject: reject, regex: regex, collect: collect };
    });
}

export function send(data) {
    bashProcess.stdin.write(data + "\n");
}

export function end() {
    bashProcess.stdin.end();
}