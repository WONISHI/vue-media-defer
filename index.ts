import MediaDefer from "./src/MediaDefer.vue";


type SFCWithInstall = typeof MediaDefer & {
  install: (app: any) => void;
};


const _MediaDefer = MediaDefer as SFCWithInstall;

_MediaDefer.install = (app: any) => {
  if (_MediaDefer.name) {
    app.component(_MediaDefer.name, _MediaDefer);
  }
};

export default _MediaDefer;
