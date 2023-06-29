const { ASTPatternMatcher } = require('../matcher');
const fs = require('fs');
const path = require('path');

const ACORN_OPTIONS = { allowImportExportEverywhere: true, ecmaVersion: 2020 };

function runSingleTest(testSample, signatures) {
    const samplePath = path.join(__dirname, 'data', testSample);
    const sampleCode = fs.readFileSync(samplePath, 'utf-8');
    const parsedData = require('@babel/parser').parse(
        sampleCode,
        ACORN_OPTIONS
    );
    const matcher = new ASTPatternMatcher();
    const boundaries = [];
    for (const sig of signatures) {
        const patternPath = path.join(__dirname, '../patterns/', sig);
        const patternBody = fs.readFileSync(patternPath);
        const pattern = JSON.parse(patternBody);
        for (const check of pattern.checks) {
            for (const result of matcher.match(
                check,
                parsedData,
                pattern.$depth,
                pattern.$length,
                pattern.$maxTraverseDepth,
            )) {
                if (result) {
                    const [_, bounds] = result;
                    boundaries.push({ pattern: sig, boundaries: bounds });
                }
            }
        }
    }
    return boundaries;
}

exports.runSingleTest = runSingleTest;
