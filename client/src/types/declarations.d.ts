declare module '@breezystack/lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, samplerate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }
  export class WavHeader {
    static readHeader(dataView: DataView): any;
  }
  const defaultExport: {
    Mp3Encoder: typeof Mp3Encoder;
    WavHeader: typeof WavHeader;
  };
  export default defaultExport;
}

declare module 'lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, samplerate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }
  export class WavHeader {
    static readHeader(dataView: DataView): any;
  }
}

declare module 'browser-id3-writer' {
  export class ID3Writer {
    constructor(buffer: ArrayBuffer);
    setFrame(frameName: string, value: any): ID3Writer;
    addTag(): ID3Writer;
    getBlob(): Blob;
    getURL(): string;
    revokeURL(): void;
  }
}
