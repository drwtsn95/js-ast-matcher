'use strict';
const fs = require('fs');
const { ArgumentParser } = require('argparse');
const ACORN_OPTIONS = { allowImportExportEverywhere: true, ecmaVersion: 2020 };

const { ASTPatternMatcher } = require('./matcher');

const parser = new ArgumentParser({
    description: 'AST-Based Pattern Matcher',
    add_help: true,
});

parser.add_argument('-f', '--infile', {
    help: 'provide filename instead of stdin use',
    action: 'store',
});
parser.add_argument('patterns', {
    help: 'filename of the AST pattern',
    nargs: '+',
});
parser.add_argument('-d', '--directory', {
    help: 'run matcher on whole directory with ONLY JS FILES',
    action: 'store',
});

const args = parser.parse_args();

let boundaries = [];

if (args.infile) {
    const data = fs.readFileSync(args.infile, 'utf-8');
    const parsedData = require('@babel/parser').parse(data, ACORN_OPTIONS);
    const signatures = args.patterns;
    const matcher = new ASTPatternMatcher();
    for (const sig of signatures) {
        const pattern = JSON.parse(fs.readFileSync(sig));
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
} else if (args.directory) {
    const dir = args.directory;
    fs.readdirSync(dir).forEach((file) => {
        const data = fs.readFileSync(`${dir}/${file}`, 'utf-8');
        const parsedData = require('@babel/parser').parse(data, ACORN_OPTIONS);
        const signatures = args.patterns;
        const matcher = new ASTPatternMatcher();
        for (const sig of signatures) {
            const pattern = JSON.parse(fs.readFileSync(sig));
            for (const check of pattern.checks) {
                for (const result of matcher.match(
                    check,
                    parsedData,
                    pattern.$depth,
                    pattern.$length
                )) {
                    if (result) {
                        const [_, bounds] = result;
                        boundaries.push({ pattern: sig, boundaries: bounds });
                    }
                }
            }
        }
    });
} else {
    const data = fs.readFileSync('/dev/stdin', 'utf-8');
    const parsedData = require('@babel/parser').parse(data, ACORN_OPTIONS);
    const signatures = args.patterns;
    const matcher = new ASTPatternMatcher();
    for (const sig of signatures) {
        const pattern = JSON.parse(fs.readFileSync(sig));
        for (const check of pattern.checks) {
            for (const result of matcher.match(
                check,
                parsedData,
                pattern.$depth,
                pattern.$length
            )) {
                if (result) {
                    const [_, bounds] = result;
                    boundaries.push({ pattern: sig, boundaries: bounds });
                }
            }
        }
    }
}
console.log(JSON.stringify(boundaries));
