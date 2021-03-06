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
import sinon from 'sinon';
import {expect} from 'chai';

import {_private} from '../../../packages/workbox-core/index.mjs';
import {compareResponses} from '../utils/response-comparisons.mjs';

import {CacheFirst} from '../../../packages/workbox-runtime-caching/CacheFirst.mjs';

describe(`[workbox-runtime-caching] CacheFirst`, function() {
  let sandbox = sinon.sandbox.create();

  beforeEach(async function() {
    let usedCacheNames = await caches.keys();
    await Promise.all(usedCacheNames.map((cacheName) => {
      return caches.delete(cacheName);
    }));

    sandbox.restore();
  });

  after(async function() {
    let usedCacheNames = await caches.keys();
    await Promise.all(usedCacheNames.map((cacheName) => {
      return caches.delete(cacheName);
    }));

    sandbox.restore();
  });

  it(`should be able to fetch and cache a request to default cache`, async function() {
    const request = new Request('http://example.io/test/');
    const event = new FetchEvent('fetch', {request});

    const fetchResponse = new Response('Hello Test.');
    sandbox.stub(global, 'fetch').callsFake((req) => {
      expect(req).to.equal(request);
      return Promise.resolve(fetchResponse);
    });
    let cachePromise;
    sandbox.stub(event, 'waitUntil').callsFake((promise) => {
      cachePromise = promise;
    });

    const cacheFirst = new CacheFirst();
    const firstHandleResponse = await cacheFirst.handle({event});

    // Wait until cache.put is finished.
    await cachePromise;
    const cache = await caches.open(_private.cacheNames.getRuntimeName());
    const firstCachedResponse = await cache.match(request);

    await compareResponses(firstCachedResponse, fetchResponse, true);
    await compareResponses(firstHandleResponse, fetchResponse, true);

    const secondHandleResponse = await cacheFirst.handle({event});

    // Reset spy state so we can check fetch wasn't called.
    global.fetch.reset();

    const secondCachedResponse = await cache.match(request);
    await compareResponses(firstCachedResponse, secondHandleResponse, true);
    await compareResponses(firstCachedResponse, secondCachedResponse, true);
    expect(fetch.callCount).to.equal(0);
  });

  it(`should be able to cache a non-existant request to custom cache`, async function() {
    const cacheName = 'test-cache-name';
    const request = new Request('http://example.io/test/');
    const event = new FetchEvent('fetch', {request});

    sandbox.stub(global, 'fetch').callsFake((req) => {
      expect(req).to.equal(request);
      return Promise.resolve(new Response('Hello Test.'));
    });
    let cachePromise;
    sandbox.stub(event, 'waitUntil').callsFake((promise) => {
      cachePromise = promise;
    });

    const cacheFirst = new CacheFirst({
      cacheName,
    });
    const firstHandleResponse = await cacheFirst.handle({event});

    // Wait until cache.put is finished.
    await cachePromise;
    const cache = await caches.open(cacheName);
    const firstCachedResponse = await cache.match(request);

    await compareResponses(firstHandleResponse, firstCachedResponse, true);
  });

  it(`should not cache an opaque response by default`, async function() {
    const request = new Request('http://example.io/test/');
    const event = new FetchEvent('fetch', {request});

    sandbox.stub(global, 'fetch').callsFake((req) => {
      expect(req).to.equal(request);
      return Promise.resolve(new Response('Hello Test.', {
        status: 0,
      }));
    });
    let cachePromise;
    sandbox.stub(event, 'waitUntil').callsFake((promise) => {
      cachePromise = promise;
    });

    const cacheFirst = new CacheFirst();
    const firstHandleResponse = await cacheFirst.handle({event});

    // Wait until cache.put is finished.
    await cachePromise;
    const cache = await caches.open(_private.cacheNames.getRuntimeName());
    const firstCachedResponse = await cache.match(request);

    expect(firstCachedResponse).to.equal(null);
    expect(firstHandleResponse).to.exist;
  });

  it(`should cache an opaque response when a cacheWillUpdate plugin returns true`, async function() {
    const request = new Request('http://example.io/test/');
    const event = new FetchEvent('fetch', {request});

    sandbox.stub(global, 'fetch').callsFake((req) => {
      expect(req).to.equal(request);
      return Promise.resolve(new Response('Hello Test.', {
        status: 0,
      }));
    });
    let cachePromise;
    sandbox.stub(event, 'waitUntil').callsFake((promise) => {
      cachePromise = promise;
    });

    const cacheFirst = new CacheFirst({
      plugins: [
        {
          cacheWillUpdate: ({request, response}) => {
            return response;
          },
        },
      ],
    });
    const firstHandleResponse = await cacheFirst.handle({event});

    // Wait until cache.put is finished.
    await cachePromise;
    const cache = await caches.open(_private.cacheNames.getRuntimeName());
    const firstCachedResponse = await cache.match(request);

    await compareResponses(firstHandleResponse, firstCachedResponse, true);
  });

  it(`should return the plugin cache response`, async function() {
    const request = new Request('http://example.io/test/');
    const event = new FetchEvent('fetch', {request});

    const injectedResponse = new Response('response body');
    const cache = await caches.open(_private.cacheNames.getRuntimeName());
    await cache.put(request, injectedResponse.clone());

    const pluginResponse = new Response('plugin response');
    const cacheFirst = new CacheFirst({
      plugins: [
        {
          cachedResponseWillBeUsed: () => {
            return pluginResponse;
          },
        },
      ],
    });
    const firstHandleResponse = await cacheFirst.handle({event});

    await compareResponses(firstHandleResponse, pluginResponse, true);
  });

  it(`should fallback to fetch if the plugin.cacheResponseWillBeUsed returns null`, async function() {
    const request = new Request('http://example.io/test/');
    const event = new FetchEvent('fetch', {request});

    const fetchResponse = new Response('Hello Test.');
    sandbox.stub(global, 'fetch').callsFake((req) => {
      expect(req).to.equal(request);
      return Promise.resolve(fetchResponse);
    });
    let cachePromise;
    sandbox.stub(event, 'waitUntil').callsFake((promise) => {
      cachePromise = promise;
    });

    const injectedResponse = new Response('response body');
    const cache = await caches.open(_private.cacheNames.getRuntimeName());
    await cache.put(request, injectedResponse.clone());

    const cacheFirst = new CacheFirst({
      plugins: [
        {
          cachedResponseWillBeUsed: () => {
            return null;
          },
        },
      ],
    });
    const firstHandleResponse = await cacheFirst.handle({event});

    // Wait until cache.put is finished.
    await cachePromise;

    // The cache should be overriden
    const firstCachedResponse = await cache.match(request);

    await compareResponses(firstCachedResponse, fetchResponse, true);
    await compareResponses(firstHandleResponse, fetchResponse, true);
  });
});
