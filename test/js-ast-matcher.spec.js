const { expect } = require('chai');
const { runSingleTest } = require('./utils');
const fs = require('fs');
const path = require('path');

describe('Pattern matching', () => {
    context('on finding jQuery', () => {
        it('should match jQuery pattern if it presents - 1', () => {
            const testSample = 'test-jquery-1.js';
            const result = runSingleTest(testSample, [
                'ASTpattern_jQuery.json',
            ]);
            expect(result.length).to.be.equal(1);
            expect(result).to.include.deep.members([
                { pattern: 'ASTpattern_jQuery.json', boundaries: [0, 139822] },
            ]);
        });

        it('should match jQuery pattern if it presents - 2', () => {
            const testSample = 'test-jquery-2.js';
            const result = runSingleTest(testSample, [
                'ASTpattern_jQuery.json',
            ]);
            expect(result.length).to.be.equal(1);
            expect(result).to.include.deep.members([
                {
                    pattern: 'ASTpattern_jQuery.json',
                    boundaries: [1839, 268763],
                },
            ]);
        });
    });

    context('on finding AngularJS', () => {
        it('should match AngularJS pattern if it presents - 1', () => {
            const testSample = 'test-angular-1.js';
            const result = runSingleTest(testSample, [
                'ASTpattern_AngularJS.json',
            ]);
            expect(result.length).to.be.equal(1);
            expect(result).to.include.deep.members([
                {
                    pattern: 'ASTpattern_AngularJS.json',
                    boundaries: [111, 955398],
                },
            ]);
        });

        it('should match AngularJS pattern if it presents - 2', () => {
            const testSample = 'test-angular-2.js';
            const result = runSingleTest(testSample, [
                'ASTpattern_AngularJS.json',
            ]);
            expect(result.length).to.be.equal(1);
            expect(result).to.include.deep.members([
                {
                    pattern: 'ASTpattern_AngularJS.json',
                    boundaries: [86, 176956],
                },
            ]);
        });
    });

    context('max traverse depth', () => {
        it('should match pattern if traverseDepth is not exceeded - 1', () => {
            const testSample = 'test-max-traverse-depth-1.js';
            const result = runSingleTest(testSample, [
                'test-pattern.json',
            ]);
            expect(result.length).to.be.equal(1);
        });
        it('should not match pattern deeper than needed', () => {
            const testSample = 'test-max-traverse-depth-2.js';
            const result = runSingleTest(testSample, [
                'test-pattern.json',
            ]);
            expect(result.length).to.be.equal(0);
        });
        it('should match pattern if traverseDepth is not exceeded - 2', () => {
            const testSample = 'test-max-traverse-depth-3.js';
            const result = runSingleTest(testSample, [
                'test-pattern.json',
            ]);
            expect(result.length).to.be.equal(1);
        });
    });
});
