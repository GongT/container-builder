#!/usr/bin/env node

import { install } from 'source-map-support';
if (!process.execArgv.some((e) => e.startsWith('--inspect'))) {
	install();
}

import 'reflect-metadata';
import './lib/bundle.js';
