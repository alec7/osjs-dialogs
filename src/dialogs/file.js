/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2018, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

import {h, app} from 'hyperapp';
import Dialog from '../dialog';
import {
  TextField,
  SelectField,
  listView
} from '@osjs/gui';

const getMountpoint = str => str
  .split(':')[0] + ':/';

const getMountpoints = core => core.make('osjs/fs')
  .mountpoints(true)
  .filter(mount => {
    return !(mount.attributes.readOnly && mount.attributes.visibility === 'restricted');
  })
  .reduce((mounts, iter) => Object.assign(mounts, {
    [iter.root]: iter.label
  }), {});

/**
 * Default OS.js File Dialog
 */
export default class FileDialog extends Dialog {

  /**
   * Constructor
   * @param {Core} core OS.js Core reference
   * @param {Object} args Arguments given from service creation
   * @param {String} [args.title] Dialog title
   * @param {Function} callback The callback function
   */
  constructor(core, args, callback) {
    args = Object.assign({}, {
      title: null,
      type: 'open',
      path: null,
      filename: null,
      mime: []
    }, args);

    if (!args.path) {
      args.path = core.config('vfs.defaultPath');
    }

    if (typeof args.path === 'string') {
      args.path = {path: args.path};
    }

    const _ = core.make('osjs/locale').translate;
    const title = args.title
      ? args.title
      : (args.type === 'open' ? _('LBL_OPEN') : _('LBL_SAVE'));

    super(core, args, {
      className: 'file',
      window: {
        title,
        attributes: {
          resizable: true
        },
        dimension: {
          width: 400,
          height: 400
        }
      },
      buttons: ['ok', 'cancel']
    }, callback);
  }

  render(options) {
    const getFileIcon = file => this.core.make('osjs/fs').icon(file);
    const startingLocation = this.args.path;

    super.render(options, ($content) => {
      const a = app({
        mount: startingLocation ? getMountpoint(startingLocation.path) : null,
        filename: this.args.filename,
        listview: listView.state({
          columns: [{
            label: 'Name'
          }, {
            label: 'Type'
          }, {
            label: 'Size'
          }]
        })
      }, {
        _readdir: ({path, files}) => (state, actions) => {
          const listview = state.listview;
          listview.selectedIndex = -1;
          listview.rows = files.map(file => ({
            columns: [{
              label: file.filename,
              icon: getFileIcon(file)
            }, file.mime, file.humanSize],
            data: file
          }));

          return {path, listview};
        },

        setMountpoint: mount => (state, actions) => {
          actions.setPath({path: mount});

          return {mount};
        },

        setPath: file => async (state, actions) => {
          const files = await this.core.make('osjs/vfs')
            .readdir(file, {
              filter: (item) => {
                if (this.args.mime) {
                  return item.mime
                    ? this.args.mime.some(test => (new RegExp(test)).test(item.mime))
                    : true;
                }

                return true;
              }
            });

          this.args.path = file;

          actions._readdir({path: file.path, files});
        },

        setFilename: filename => state => ({filename}),

        listview: listView.actions({
          select: ({data}) => {
            a.setFilename(data.isFile ? data.filename : null);
            this.value = data.isFile ? data : null;
          },
          activate: ({data, ev}) => {
            if (data.isDirectory) {
              a.setFilename(null);
              a.setPath(data);
            } else {
              this.value = data.isFile ? data : null;
              this.emitCallback(this.getPositiveButton(), ev, true);
            }
          },
        })
      }, (state, actions) => this.createView([
        h(SelectField, {
          choices: getMountpoints(this.core),
          onchange: (ev, val) => a.setMountpoint(val),
          value: state.mount
        }),
        h(listView.component(Object.assign({
          box: {grow: 1, shrink: 1}
        }, state.listview), actions.listview)),
        h(TextField, {
          placeholder: 'Filename',
          value: state.filename,
          onenter: (ev, value) => this.emitCallback(this.getPositiveButton(), ev, true),
          box: {
            style: {display: this.args.type === 'save' ? null : 'none'}
          }
        })
      ]), $content);

      a.setPath(startingLocation);
    });
  }

  getValue() {
    if (this.args.type === 'save') {
      const {path} = this.args.path;
      const filename = this.win.$content.querySelector('input[type=text]')
        .value;

      return filename
        ? Object.assign({}, this.args.path, {
          filename,
          path: path.replace(/\/?$/, '/') + filename
        })
        : undefined;
    }

    return super.getValue();
  }

}
