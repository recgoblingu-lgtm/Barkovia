/*
 * The Unity data file is 263,601,861 bytes and remains split across two public files.
 * This preserves the source site's delivery path. Only the small Unity runtime files are
 * mirrored into this Manus-hosted site; the first visit still downloads the data chunks.
 */
(function () {
  var DATA_FILE = 'public.data.unityweb';
  var PARTS = [
    'https://files.catbox.moe/ep1cv0.bin',
    'https://files.catbox.moe/op07q8.bin'
  ];
  var TOTAL = 263601861;
  var CACHE_PREFIX = 'rr2017-data-';
  var CACHE_NAME = CACHE_PREFIX + PARTS.map(function (url) { return url.split('/').pop(); }).join('-');
  var originalDownloadJob = UnityLoader.downloadJob;

  UnityLoader.downloadJob = function (Module, job) {
    var parameters = job.parameters;
    if (!parameters.url || parameters.url.slice(-DATA_FILE.length) !== DATA_FILE) {
      return originalDownloadJob.apply(this, arguments);
    }
    var progress = function (loaded) {
      if (parameters.onprogress) {
        parameters.onprogress({ type: 'progress', lengthComputable: true, loaded: loaded, total: TOTAL });
      }
    };
    loadData(progress).then(function (bytes) {
      if (parameters.onload) {
        parameters.onload({ type: 'load', lengthComputable: true, loaded: TOTAL, total: TOTAL });
      }
      UnityLoader.Compression.decompress(bytes, function (data) { job.complete(data); });
    }).catch(function (error) {
      console.error('[split-data] ' + error);
      if (window.showGameError) {
        window.showGameError('Could not download the 264 MB game data. The external file host may be unavailable or blocked. Check your connection and reload to retry.');
      } else {
        alert('Could not download the game data. Please check your connection and reload.');
      }
    });
  };

  function openCache() {
    if (!window.caches) return Promise.resolve(null);
    return caches.open(CACHE_NAME).catch(function () { return null; });
  }

  function loadData(progress) {
    return openCache().then(function (cache) {
      var lookup = cache ? cache.match(DATA_FILE).catch(function () { return null; }) : Promise.resolve(null);
      return lookup.then(function (hit) {
        if (hit) {
          return hit.arrayBuffer().then(function (buffer) {
            if (buffer.byteLength !== TOTAL) throw new Error('cached copy has the wrong size');
            progress(TOTAL);
            return new Uint8Array(buffer);
          });
        }
        return download(progress).then(function (bytes) {
          if (cache) {
            cache.put(DATA_FILE, new Response(bytes)).then(removeOldCaches).catch(function (error) {
              console.warn('[split-data] could not cache game data: ' + error);
            });
          }
          return bytes;
        });
      });
    });
  }

  function download(progress) {
    var output = new Uint8Array(TOTAL);
    var offset = 0;
    return PARTS.reduce(function (chain, url) {
      return chain.then(function () {
        return fetch(url).then(function (response) {
          if (!response.ok) throw new Error('external data host returned HTTP ' + response.status);
          if (!response.body || !response.body.getReader) throw new Error('streaming downloads are unavailable');
          var reader = response.body.getReader();
          function pump() {
            return reader.read().then(function (chunk) {
              if (chunk.done) return;
              if (offset + chunk.value.length > TOTAL) throw new Error('game data is larger than expected');
              output.set(chunk.value, offset);
              offset += chunk.value.length;
              progress(offset);
              return pump();
            });
          }
          return pump();
        });
      });
    }, Promise.resolve()).then(function () {
      if (offset !== TOTAL) throw new Error('downloaded ' + offset + ' of ' + TOTAL + ' bytes');
      return output;
    });
  }

  function removeOldCaches() {
    return caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE_NAME;
      }).map(function (name) { return caches.delete(name); }));
    });
  }
})();
