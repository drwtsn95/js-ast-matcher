# js-ast-matcher
JavaScript AST Pattern Matcher

## Build

### from sources
```bash
git clone https://github.com/drwtsn95/js-ast-matcher
npm install
```
### via NPM
```bash
npm install js-ast-matcher
```
## Run
You can run the matcher either using the cli or by importing it from your code.
### From CLI
```
node checker.js [-h] [-f INFILE] [-d DIRECTORY] patterns [patterns ...]

positional arguments:
  patterns              filename of the AST pattern

optional arguments:
  -h, --help            show this help message and exit
  -f INFILE, --infile INFILE
                        provide filename instead of stdin use
  -d DIRECTORY, --directory DIRECTORY
                        run matcher on whole directory with ONLY JS FILES
```
