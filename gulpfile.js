const gulp = require('gulp');
const browserSync = require("browser-sync");
const reload = browserSync.reload;
const webpackStream = require('webpack-stream');
const webpack = webpackStream.webpack;
const WebpackOnBuildPlugin = require('on-build-webpack');
const pathPlugin = require('path');
const named = require('vinyl-named');
const { phpMinify } = require('@cedx/gulp-php-minify');
const del = require('del');  // check if i need that
const pngquant = require('imagemin-pngquant');
const plugins = require('gulp-load-plugins')({ // this one requires all plugins with prefix 'gulp-'
  pattern: ['gulp-*', 'gulp.*'],
  replaceString: /\bgulp[\-.]/
});
const autoprefixer = require('autoprefixer');
const mqpacker = require('css-mqpacker');
const csso = require('postcss-csso');
const short = require('postcss-short');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV == "development";
// CONFIG     
const options = require('./gulp/config/options');
const config = options.config;
const BrowserSyncConfig = options.BrowserSyncConfig;
const webpackConfig = options.webpackConfig;
// const webpackConfigProd = options.webpackConfigProd;
const htmlMinOptions = options.htmlMinOptions;
const buffer = require('vinyl-buffer');
// Path options 
const path = require('./gulp/path/path');
const spritesmithConfig = {
  cssName: 'sprite.css',
  imgName: 'sprite.png', // image nam by default  'sprite.png'
  retinaImgName: 'sprite@2x.png', // image nam by default   'sprite@2x.png'
  imgPath: config.pngSprite, // path to image that should know css // '../img/sprite.png'
  retinaImgPath: config.pngSpriteRetina, // path to retina image that should know css // '../img/sprite@2x.png'
  retinaSrcFilter: 'src/img/sprite/*@2x.png', // retina images should be in same folder as non-retina 
};
// const nunjucksLimitFilter = require('nunjucks-limit-filter');
// var nunjucksLimitFilter = function (input, limit) {
//   'use strict';
//   if (typeof limit !== 'number') {
//     return input;
//   }
//   if (typeof input === 'string') {
//     if (limit >= 0) {
//       return input.substring(0, limit);
//     } else {
//       return input.substr(limit);
//     }
//   }
//   if (Array.isArray(input)) {
//     limit = Math.min(limit, input.length);
//     if (limit >= 0) {
//       return input.splice(0, limit);
//     } else {
//       return input.splice(input.length + limit, input.length);
//     }
//   }
//   return input;
// };
// const nunjucks = require('nunjucks');
// var env = new nunjucks.Environment();
// env.addFilter('limitTo', nunjucksLimitFilter);



gulp.task('webserver', function () { // Webserver start task 
  browserSync(BrowserSyncConfig);
});
gulp.task('check-enviroment', function () {
  console.group('Check eniroment. Enviroment is dev : ' + isDevelopment);
});

const data = require('./src/data.json');
// DEVELOPMENT BUILDING TASKS
gulp.task('build:html', function () { // HTML src --> development
  gulp.src(path.src.html)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Build html error',
          message: err.message
        }
      })
    }))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug('changed html: ')))
    // .pipe(plugins.data(function () { return require(path.src.data) }))
    .pipe(plugins.if(config.nunjucksOn, plugins.nunjucks.compile(data), plugins.rigger()))
    .pipe(gulp.dest(path.dev.htmlDest))
    .pipe(reload({ stream: true }));
});
gulp.task('build:html-partial', function () {
  gulp.src(path.src.html)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Build partials html error',
          message: err.message
        }
      })
    }))
    .pipe(plugins.changed(path.dev.htmlDest))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug('changed html: ')))
    // .pipe(plugins.data(function () { return require(path.src.data) }))
    .pipe(plugins.if(config.nunjucksOn, plugins.nunjucks.compile(data), plugins.rigger()))
    .pipe(gulp.dest(path.dev.htmlDest))
    .pipe(reload({ stream: true }));
});
// stuff for css compilation
var processors = [
  autoprefixer({
    browsers: ['last 4 versions'],
    cascade: false
  }),
  // require('lost'), need ?
  mqpacker({
    sort: sortMediaQueries
  }),
  csso,
  short,
];
function isMax(mq) {
  return /max-width/.test(mq);
}
function isMin(mq) {
  return /min-width/.test(mq);
}
function sortMediaQueries(a, b) {
  A = a.replace(/\D/g, '');
  B = b.replace(/\D/g, '');
  if (isMax(a) && isMax(b)) {
    return B - A;
  } else if (isMin(a) && isMin(b)) {
    return A - B;
  } else if (isMax(a) && isMin(b)) {
    return 1;
  } else if (isMin(a) && isMax(b)) {
    return -1;
  }
  return 1;
}
// stuff for css compilation END
gulp.task('build:style', function () { // CSS src --> development
  gulp.src(path.src.style)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Build style error',
          message: err.message
        }
      })
    }))
    .pipe(plugins.if(config.cssSourcemap, plugins.sourcemaps.init()))
    .pipe(plugins.sass({
      outputStyle: 'nested', // nested, expanded, compact, compressed
      precision: 5
    }))
    .pipe(plugins.postcss(processors))
    .pipe(plugins.if(config.cssSourcemap, plugins.sourcemaps.write('./')))
    .pipe(gulp.dest(path.dev.styleDest)) // build css in folder 
    .pipe(browserSync.stream()) // livereload page
});
gulp.task('build:js', function () { // JS src --> development
  gulp.src(path.src.js)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Build JS error',
          message: err.message
        }
      })
    }))
    .pipe(named())
    .pipe(webpackStream(webpackConfig))
    .pipe(plugins.if(config.removeJsConsoleLogDev, plugins.removeLogging()))
    // .pipe(plugins.if(config.concatJS, plugins.concat('main.js'))) // build js to 1 file 
    .pipe(gulp.dest(path.dev.jsDest))
    .pipe(browserSync.stream()); // livereload page
});
gulp.task('build:img', function () { //relocate images to dev
  gulp.src(path.src.img)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Image build error',
          message: err.message
        }
      })
    }))
    .pipe(plugins.if(config.checkChanged, plugins.changed('dev/img')))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug()))
    .pipe(gulp.dest(path.dev.imgDest))
    .pipe(browserSync.stream());
});
gulp.task('build:sprite', function () { // Build sprite image
  var spriteData = gulp.src('src/img/sprite/*.png')
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Sprite build error',
          message: err.message
        }
      })
    }))
    .pipe(plugins.spritesmith(spritesmithConfig));

  spriteData.img.pipe(gulp.dest("dev/img")) // path where save sprite image
    .pipe(plugins.if(config.checkChanged, plugins.debug({ "title": "sptire images generated: " })));
  spriteData.css.pipe(gulp.dest(path.src.spriteCss)) // path where save sprite css
    .pipe(plugins.if(config.checkChanged, plugins.debug({ "title": "sptire css generated: " })));
});
// Lint Php
gulp.task('build:php', function () { // test
  return gulp.src(path.src.php)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Php build error',
          message: err.message
        }
      })
    }))
    .pipe(gulp.dest('dev/'))
});
// replace fonts 
gulp.task('build:fonts', function () {
  let destination = path.dev.fonts;
  return gulp.src('src/fonts/**/*.*')
    .pipe(plugins.if(config.checkChanged, plugins.changed(destination)))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug('fonts files added: ')))
    .pipe(gulp.dest(destination))
    .pipe(browserSync.stream());
})
// replace vendor files & media 
gulp.task('build:vendor', function () {
  let destination = 'dev/vendor/';
  return gulp.src(path.src.vendor)
    .pipe(plugins.if(config.checkChanged, plugins.changed(destination)))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug('vendor files added: ')))
    .pipe(gulp.dest(destination))
    .pipe(reload({ stream: true }));
})
gulp.task('build:vendor-js', function () {
  let dest = 'dev/js/vendor/';
  return gulp.src('src/js/vendor/**/*.*')
    .pipe(plugins.if(config.checkChanged, plugins.changed(dest)))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug('vendor js files added: ')))
    .pipe(gulp.dest(dest))
    .pipe(reload({ stream: true }));
});

// clear some text task
gulp.task("clear", function () { // not using now
  return del(
    ['dev/style/main.css'],
    { read: false } // preven from insert object in memory
  );
});


// DEVELOPMENT BUILDING TASKS END

gulp.task('build', [
  'build:html',
  'build:style',
  'build:js',
  'build:vendor-js',
  'build:img',
  'build:vendor',
  'build:sprite',
  'build:php',
  'build:fonts',
]);
// 

// Watcher that will autoupdate development
let watchOptions = {
  style: true,
  js: false
};
gulp.task('watch', function () {
  // watch HTML to Build All
  plugins.watch('src/templates/*/*.html', function (event, cb) {
    gulp.start('build:html');
  });
  // watch HTML to Build 
  plugins.watch(path.src.html, function (event, cb) {
    gulp.start('build:html-partial');
  });
  // Watch HTML to livereload
  plugins.watch([path.dev.html], function (event, cb) {
    gulp.src(path.dev.html)
      .pipe(browserSync.stream());
  });
  if (watchOptions.style) { // Watch styles 
    // plugins.watch([path.src.style, 'src/style/*/*.scss'], function (event, cb) {
    plugins.watch('src/style/**/*.{scss,sass,css}', function (event, cb) {
      gulp.start('build:style');
    })
  }
  if (watchOptions.js) {// Watch js to concat and livereload
    plugins.watch(path.src.jsWatch, function (event, cb) {
      gulp.start('build:js');
    })
  }
  // Watch images
  plugins.watch(path.src.img, function (event, cb) {
    gulp.start('build:img');
  });
  //Watch sprites
  plugins.watch([path.src.sprite], function (event, cb) {
    gulp.start('build:sprite');
    gulp.start('build:style');
  });
  //Watch php
  plugins.watch([path.src.php], function (event, cb) {
    gulp.start('build:php');
  });
  plugins.watch(path.src.vendor, function () {
    gulp.start('build:vendor');
  });
  plugins.watch('src/fonts/**/*.*', function () {
    gulp.start('build:fonts');
  });
  plugins.watch('src/js/vendor/**/*.*', function () {
    gulp.start('build:vendor-js');
  });
});
// 

// To production stage
gulp.task("prod", [
  'prod:html', // check - ok
  'prod:php', // check
  'prod:sprite', // check
  'prod:style', // check
  'prod:js', // check - ok
  'prod:fonts', // check - ok
  'prod:img', // check
  'prod:htaccess', // check - ok
  'prod:vendor', // check - ok
]);

gulp.task('prod:html', function () {
  let destination = path.prod.root;
  gulp.src(path.src.html)
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size before minify htm : ' })))
    .pipe(plugins.data(function () { return require(path.src.data) }))
    .pipe(plugins.if(config.nunjucksOn, plugins.nunjucks.compile(), plugins.rigger()))
    //.pipe(plugins.if(config.minifyHTML, plugins.htmlmin(htmlMinOptions)))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug({ title: 'Changed html min files : ' })))
    .pipe(gulp.dest(destination))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size after minify htm : ' })))
});
gulp.task('prod:style', function () {
  let destination = path.prod.style;
  gulp.src(path.src.style)
    .pipe(plugins.sass({ outputStyle: 'compressed', precision: 5 }))
    .pipe(plugins.postcss(processors))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size before minify css : ' })))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug({ title: 'Minified css : ' })))
    .pipe(plugins.if(config.minifyCSS, plugins.cleanCss({ compatibility: 'ie8' })))
    .pipe(gulp.dest(destination))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size after minify css : ' })))
});
gulp.task('prod:sprite', function () { // Build sprite image
  var spriteData = gulp.src('src/img/sprite/*.png')
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Sprite prod error',
          message: err.message
        }
      })
    }))
    .pipe(plugins.spritesmith(spritesmithConfig));
  spriteData.img
    .pipe(buffer())
    .pipe(plugins.imagemin({
      progressive: true,
      svgoPlugins: [{ removeViewBox: false }],
      use: [pngquant()],
      interlaced: true
    }))
    .pipe(gulp.dest("prod/img")) // path where save sprite image
    .pipe(plugins.if(config.checkChanged, plugins.debug({ "title": "Prod sptire images generated: " })));

  spriteData.css.pipe(gulp.dest(path.src.spriteCss)) // path where save sprite css
    .pipe(plugins.if(config.checkChanged, plugins.debug({ "title": "Prod sptire css generated: " })));
});

let webpackConfigProd = {
  module: {
    loaders: [{
      test: /\.js/,
      include: pathPlugin.join(__dirname, 'src'),
      loader: 'babel-loader',
    }]
  },
  plugins: [ // list - https://github.com/webpack/docs/wiki/list-of-plugins
    new webpack.optimize.UglifyJsPlugin({
      output: { comments: false },
      compress: {
        warnings: false, // remove warnings
        drop_console: true // Drop console statements
      },
    }),
    new webpack.NoEmitOnErrorsPlugin(),
  ]
};
gulp.task('prod:js', function () { // Minify all js files
  let destination = path.prod.js;
  gulp.src(path.src.js)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'Pord JS error',
          message: err.message
        }
      })
    }))
    .pipe(named())
    .pipe(webpackStream(webpackConfigProd))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size before minify js : ' })))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug({ title: 'Uglified js : ' })))
    .pipe(gulp.dest(destination))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size after minify js : ' })))
});
gulp.task('prod:fonts', function () {
  del("prod/fonts/*.*", { read: false }); // clear all old files 
  gulp.src(path.src.fonts)
    .pipe(gulp.dest(path.prod.fonts));
});
gulp.task('prod:img', function () {
  let destination = path.prod.img;
  return gulp.src(path.src.img)
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size before minify images : ' })))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug({ title: 'images changed: ' })))
    .pipe(plugins.imagemin({
      progressive: true,
      svgoPlugins: [{ removeViewBox: false }],
      use: [pngquant()],
      interlaced: true
    }))
    .pipe(gulp.dest(destination))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size after minify images : ' })))
});
gulp.task('prod:php', function () { // test
  let destination = path.prod.root;
  gulp.src(path.src.php)
    .pipe(plugins.plumber({
      errorHandler: plugins.notify.onError(function (err) {
        return {
          title: 'PHP',
          message: err.message
        }
      })
    }))
    .pipe(plugins.if(config.checkChanged, plugins.changed(destination)))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size before minify php : ' })))
    .pipe(plugins.if(config.showGulpDebug, plugins.debug({ title: 'PHP files minified' })))
    .pipe(plugins.if(config.minifyPHP, phpMinify()))
    .pipe(gulp.dest(destination))
    .pipe(plugins.if(config.showSizes, plugins.size({ title: 'size after minify php : ' })))
});
gulp.task('prod:htaccess', function () {
  gulp.src(path.src.htaccess)
    .pipe(plugins.if(config.showGulpDebug, plugins.debug({ title: 'htaccess rewriten : ' })))
    .pipe(gulp.dest(path.prod.root))
})
gulp.task('prod:vendor', function () {
  let takeFrom = path.src.vendor;
  let destination = path.prod.vendor;
  return gulp.src(takeFrom)
    .pipe(plugins.if(config.showGulpDebug, plugins.debug('vendor files added: ')))
    .pipe(gulp.dest(destination))
})

gulp.task('default', ['build', 'webserver', 'watch']);