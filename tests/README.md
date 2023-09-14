# Webinizer unit test

## How to run Webinizer unit test

1. First, make sure `emscripten` is installed. Then go to `emsdk` folder and run
   `source ./emsdk_env.`
2. Second, modify the `src/constant.ts`. Change constant `WEBINIZER_HOME` to your real webinizer
   home directory.
3. Then in terminal, go to `WEBINIZER_HOME` directory and enter `npm test` or `npm run test` to
   trigger the test running.

## How to run Webinizer unit test by category

1. Currently, we have 3 categories for unit tests, they are `action`, `advisor` and `builder`.
2. If you only want to run test case of one category, for example `action`, you can run command
   `npm test -- --grep "action"`.
3. If you want to run multiple categories, you can use command
   `npm test -- --grep "(action|advisor|builder)"` to run 3 categories.

## How to run a single Webinizer unit test case

1. If you only want to run one test case, for example `MainLoopAdvisorTest`, you can run command
   `npm test -- --grep "MainLoopAdvisorTest"`.
2. If you want to run multiple test cases, you can use command
   `npm test -- --grep "(MainLoopAdvisorTest|InlineAsmAdvisorTest)"` to run `MainLoopAdvisorTest`
   and `InlineAsmAdvisorTest`.
