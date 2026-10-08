module.exports = {
  output: "standalone",
  transpilePackages: ["@acme/ui", "@acme/lib", "@acme/utils", "@acme/forms", "@acme/theme", "@acme/api"],
  experimental: {
    cpus: 2,
  },
};
