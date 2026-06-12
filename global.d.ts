/** CSS module declarations for web-only .module.css files */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
