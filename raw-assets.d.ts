declare module "*.svg?raw" {
  const source: string;
  export default source;
}
declare module "*.ttf?url" {
  const url: string;
  export default url;
}
