/*
 Copyright 2016 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

import {CacheFirst} from './CacheFirst.mjs';
import {CacheOnly} from './CacheOnly.mjs';
import {NetworkFirst} from './NetworkFirst.mjs';
import {NetworkOnly} from './NetworkOnly.mjs';
import {StaleWhileRevalidate} from './StaleWhileRevalidate.mjs';
import pluginBuilder from './utils/pluginBuilder.mjs';
import './_version.mjs';

const mapping = {
  cacheFirst: CacheFirst,
  cacheOnly: CacheOnly,
  networkFirst: NetworkFirst,
  networkOnly: NetworkOnly,
  staleWhileRevalidate: StaleWhileRevalidate,
};

const defaultExport = {};
Object.keys(mapping).forEach((keyName) => {
  defaultExport[keyName] = (options = {}) => {
    const StrategyClass = mapping[keyName];
    const plugins = pluginBuilder(options);
    return new StrategyClass(
      Object.assign(options, {plugins})
    );
  };
});

export default defaultExport;
