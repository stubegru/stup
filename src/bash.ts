import * as child_process from 'child_process';

const VERBOSE = false;
let bashPromise;
let collector = [];
const bashProcess = child_process.spawn('bash');


function handleBashBuffer(dataBuffer) {
    let dataString: string = dataBuffer.toString("utf8");

    //remove last \n at the end (if present)
    if (dataString[dataString.length - 1] == "\n") {
        dataString = dataString.substring(0, dataString.length - 1);
    }

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


/**
 * Executes a bash command and returns the response as promise.
 *
 * @param {RegExp} [regex] - Optional regular expression to "listen" until this regex is matched in the response. Defaults to matching anything.
 * @param {boolean} [collect] - Optional flag to indicate if the response chunks until the one matching the regex should be collected into an array.
 * @returns {Promise<String | String[]>} - A promise that resolves to the response string or an array of strings if collect is true.
 */
export function bashResponse(regex?: RegExp, collect?: boolean): Promise<String | String[]> {
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

