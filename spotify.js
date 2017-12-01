const { execSync, spawn } = require('child_process');
const { EventEmitter } = require('events');
const { resolve } = require('path');
const { get } = require('snekfetch');

class Song {
	constructor(data) {
		this.title = data.track.track_resource.name;
		this.artist = data.track.artist_resource.name;
		this.played = data.playing_position;
		this.id = data.track.track_resource.uri.slice('spotify:track:'.length);
	}
}

class Spotify extends EventEmitter {
	constructor() {
		super();
		this._path = resolve(process.env.USERPROFILE, 'AppData', 'Roaming', 'Spotify', 'Data', 'SpotifyWebHelper.exe');
		this._port = 4381;
		this._open = 'https://open.spotify.com';
		this._base = `http://localhost:${this._port}`;
		this._paused = null;
		this._song = '';
	}

	_get(path, query = {}) {
		return get(`${this._base}${path}`).set('Origin', this._open).query(query);
	}
	
	_running() {
		return process.platform === 'win32' ? execSync('tasklist').includes('SpotifyWebHelper.exe') : true;
	}

	async check() {
		const { body } = await this._get('/remote/status.json', this._query);
		if (!Object.keys(body.track).length) return this.emit('stop');
		const song = new Song(body);
		if (this._playing !== body.playing) {
			this._playing = body.playing;
			if (this._playing) this.emit('unpause', song);
			else {
				this._song = song.id;
				this.emit('pause');
			}
		} else {
			if (this._song !== song.id) {
				this._song = song.id;
				this.emit('song', song);
			}
		}
	}

	async run() {
		if (!this._running) spawn(this._path, { detached: true, stdio: 'ignore' }).unref();
		const { body: token } = await get(`${this._open}/token`).set('Origin', this._open);
		const { body: csrf } = await this._get('/simplecsrf/token.json');
		this._query = { csrf: csrf.token, oauth: token.t };
		this._interval = setInterval(() => this.check(), 1e3);
		return this;
	}
}

module.exports = Spotify;