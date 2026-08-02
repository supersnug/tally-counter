declare module "*.mdx" {
  const MDXComponent: (props: Record<string, unknown>) => any;
  export default MDXComponent;
}
