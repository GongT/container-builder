import { Option } from '@commander-js/extra-typings';

export const mainProjectArg = new Option('-p, --project <path>', 'path to container.json file or folder').default('.').env('PROJECT_PATH');
