var glob = require('glob'),
    async = require('async'),
    _ = require('underscore'),
    fs = require('fs'),
    marked = require('marked'),
    join = require('path').join;

var config = {
  'title': 'Small and Sharp',
  'description': 'Node, Backbone and Javascript software development',
  'site_url': 'http://prust.github.com',
  'author': 'Peter Rust',
  'disqus_shortname': 'smallandsharp'
};

loadTemplates('article.html', {'root': 'templates'}, function(err, templates) {
  var gt = GlassTemplates(templates);

  glob('*.md', function(err, files) {
    if (err) throw err;
    if (!fs.existsSync('site'))
        fs.mkdirSync('site');

    async.map(files, processPost, function(err, entries) {
      if (err) throw new Error('Error getting post information: ' + (err.message || err));

      entries = _.sortBy(entries, 'date');
      entries.reverse();
      
      fs.writeFile(join('site', 'index.html'), gt.template(_.extend({'articles': entries}, config)), function(err) {
        if (err) throw new Error('Error writing index.html: ' + (err.message || err));
        console.log('Success! Static blog site generated.');
      });
    });
  });

  // has side-effects; split to 2 functions:
  // one that returns the article metadata, another that writes HTML
  function processPost(filename, callback) {
    fs.stat(filename, function(err, stat) {
      if (err) throw new Error('Unable to get stats of markdown file ' + filename + (err.message || err));
      var guid = filename.replace('.md', '');
      var entry = {
        'title': guid,
        'url': config.site_url + '/' + filename.replace('.md', '.html'),
        'guid': guid,
        'date': stat.ctime.toISOString()
      }
      fs.readFile(filename, 'utf-8', function(err, contents) {
        if (err) throw new Error('Unable to read markdown file ' + filename + (err.message || err));
        contents = contents.replace(/\r\n|\r/g, '\n').replace(/\u00a0/g, ' ').replace(/\u2424/g, '\n');
        
        var match;
        if (match = /^\s*#\s*(.*)$/m.exec(contents))
          entry.title = match[1];
        
        var result = markdownMeta(contents);
        if (result.meta.tags)
          entry.tags = result.meta.tags.split(/\s*,\s*/);
        if (result.meta.title)
          entry.title = result.meta.title;
        if (result.meta.date) {
          entry.date = result.meta.date;
          var dt = new Date(entry.date);
          var month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
          entry.pretty_date = month[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
        }
        entry.description = marked(result.markdown);
        fs.writeFile(join('site', filename.replace('.md', '.html')), gt.template(_.extend({'articles': entry}, config)),
          callback.bind(null, null, entry));
      });
    });
  }
});

// TODO: pull into separate repo as markdown pre-processor
// make sure it matches multmarkdown spec
function markdownMeta(input) {
  var meta = {};
  var is_meta = true;

  var sections = input.split(/\n\s*\n/);
  var first_section = sections.shift();
  first_section.split('\n').forEach(function(line) {
    if (match = /^\s*(\w+)\s*:\s*(.*)$/.exec(line))
      meta[match[1]] = match[2].trim();
    else
      is_meta = false;
  });

  if (!is_meta)
    return {'meta': {}, 'markdown': input};
  else
    return {'meta': meta, 'markdown': sections.join('\n\n')};
}