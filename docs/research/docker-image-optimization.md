# Docker Image Optimization — Primary Sources Research

> Generated: 2026-07-26
> Purpose: Gather official Docker documentation guidance on optimizing Docker image builds — size, speed, security, and maintainability.

---

## 1. Base Image Selection

### Choose the right base image

> The first step towards achieving a secure image is to choose the right base image. When choosing an image, ensure it's built from a trusted source and keep it small.
>
> When building your own image from a Dockerfile, ensure you choose a minimal base image that matches your requirements. A smaller base image not only offers portability and fast downloads, but also shrinks the size of your image and minimizes the number of vulnerabilities introduced through the dependencies.
>
> You should also consider using two types of base image: one for building and unit testing, and another (typically slimmer) image for production. In the later stages of development, your image may not require build tools such as compilers, build systems, and debugging tools. A small image with minimal dependencies can considerably lower the attack surface.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Choose the right base image"

### Alpine vs Slim vs Full images (Docker Official Images)

The Docker Official Images documentation describes three tiers:

- **`latest`**: "Optimized for ease of use and includes a wide variety of useful software, such as developer and build tools."
- **`slim`**: "Designed to provide a lightweight, production-ready base image with fewer packages. A typical consumption pattern for `slim` images is as the base image for the final stage of a multi-staged build."
- **`alpine`**: "Built on top of the Alpine Linux distribution rather than Debian or Ubuntu. Alpine Linux is focused on providing a small, simple, and secure base for container images. Docker Official Images `alpine` variants typically aim to install only necessary packages. As a result, Docker Official Images `alpine` variants are typically even smaller than `slim` variants."

> The main caveat to note is that Alpine Linux uses musl libc instead of glibc. Additionally, to minimize image size, it's uncommon for Alpine-based images to include tools such as Git or Bash by default.

Source: [Docker Docs — Trusted content (Docker Official Images)](https://docs.docker.com/docker-hub/image-library/trusted-content/), sections "Slim images" and "Alpine images"

```dockerfile
# Official example: slim as final stage
FROM node:latest AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
FROM node:slim
WORKDIR /app
COPY --from=build /app /app
CMD ["node", "app.js"]
```

### Docker recommends Alpine

> Docker recommends the Alpine image as it is tightly controlled and small in size (under 6 MB), while still being a full Linux distribution.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Choose the right base image"

### Pin base image versions

> To fully secure your supply chain integrity, you can pin the image version to a specific digest. By pinning your images to a digest, you're guaranteed to always use the same image version, even if a publisher replaces the tag with a new image.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Pin base image versions"

### Docker Hardened Images (DHI)

> Docker Hardened Images (DHIs) apply base image hardening principles by design. Each image is constructed to include only what is necessary for its specific purpose... Minimal: Only essential libraries and binaries are included. Immutable: Images are fixed at build time—no runtime installations. Non-root by default: Containers run as an unprivileged user unless configured otherwise.

Source: [Docker Docs — Docker Hardened Images](https://docs.docker.com/dhi/core-concepts/hardening/), section "Base image hardening"

---

## 2. Layer Caching and Instruction Order

### How layer caching works

> When building an image, Docker steps through the instructions in your Dockerfile, executing each in the order specified. For each instruction, the builder checks whether it can reuse the instruction from the build cache.

### Cache invalidation rules

> - The builder begins by checking if the base image is already cached. Each subsequent instruction is compared against the cached layers. If no cached layer matches the instruction exactly, the cache is invalidated.
>
> - For the `ADD` and `COPY` instructions, and for `RUN` instructions with bind mounts (`RUN --mount=type=bind`), the builder calculates a cache checksum from file metadata to determine whether cache is valid. During cache lookup, cache is invalidated if the file metadata has changed for any of the files involved.
>
> - Aside from the `ADD` and `COPY` commands, cache checking doesn't look at the files in the container to determine a cache match. For example, when processing a `RUN apt-get -y update` command the files updated in the container aren't examined to determine if a cache hit exists. In that case just the command string itself is used to find a match.
>
> Once the cache is invalidated, all subsequent Dockerfile commands generate new images and the cache isn't used.

Source: [Docker Docs — Build cache invalidation](https://docs.docker.com/build/cache/invalidation/), section "General rules"

### Order layers from least to most frequently changed

> If your build contains several layers and you want to ensure the build cache is reusable, order the instructions from less frequently changed to more frequently changed where possible.

Source: [Docker Docs — Build cache invalidation](https://docs.docker.com/build/cache/invalidation/), section "General rules"

> Putting the commands in your Dockerfile into a logical order is a great place to start. Because a change causes a rebuild for steps that follow, try to make expensive steps appear near the beginning of the Dockerfile. Steps that change often should appear near the end of the Dockerfile, to avoid triggering rebuilds of layers that haven't changed.

Source: [Docker Docs — Optimize cache usage in builds](https://docs.docker.com/build/cache/optimize/), section "Order your layers"

### The canonical example: COPY package.json first, then install, then COPY source

```dockerfile
# Inefficient: any source change re-installs all dependencies
FROM node
WORKDIR /app
COPY . .
RUN npm install
RUN npm build

# Efficient: split COPY, install dependencies before source
FROM node
WORKDIR /app
COPY package.json yarn.lock .
RUN npm install
COPY . .
RUN npm build
```

> By installing dependencies in earlier layers of the Dockerfile, there is no need to rebuild those layers when a project file has changed.

Source: [Docker Docs — Optimize cache usage in builds](https://docs.docker.com/build/cache/optimize/), section "Order your layers"

### RUN instructions are not automatically invalidated

> The cache for `RUN` instructions isn't invalidated automatically between builds.

Source: [Docker Docs — Build cache invalidation](https://docs.docker.com/build/cache/invalidation/), section "RUN instructions"

### mtime is ignored for COPY cache checksums

> The modification time of a file (`mtime`) is not taken into account when calculating the cache checksum. If only the `mtime` of the copied files have changed, the cache is not invalidated.

Source: [Docker Docs — Build cache invalidation](https://docs.docker.com/build/cache/invalidation/), section "General rules"

---

## 3. Multi-Stage Builds

### Official definition

> With multi-stage builds, you use multiple `FROM` statements in your Dockerfile. Each `FROM` instruction can use a different base, and each of them begins a new stage of the build. You can selectively copy artifacts from one stage to another, leaving behind everything you don't want in the final image.

Source: [Docker Docs — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/), section "Use multi-stage builds"

### Name your stages

> By default, the stages aren't named, and you refer to them by their integer number, starting with 0 for the first `FROM` instruction. However, you can name your stages, by adding an `AS <name>` to the `FROM` instruction. This means that even if the instructions in your Dockerfile are re-ordered later, the `COPY` doesn't break.

```dockerfile
FROM golang:1.25 AS build
WORKDIR /src
COPY <<EOF /src/main.go
...
RUN go build -o /bin/hello ./main.go

FROM scratch
COPY --from=build /bin/hello /bin/hello
CMD ["/bin/hello"]
```

Source: [Docker Docs — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/), section "Name your build stages"

### Copy only what's needed

> You can selectively copy artifacts from one stage to another, leaving behind everything you don't want in the final image.

Source: [Docker Docs — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/), section "Use multi-stage builds"

> Multi-stage builds let you reduce the size of your final image, by creating a cleaner separation between the building of your image and the final output. Split your Dockerfile instructions into distinct stages to make sure that the resulting output only contains the files that are needed to run the application.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Use multi-stage builds"

### Stop at a specific build stage

> When you build your image, you don't necessarily need to build the entire Dockerfile including every stage. You can specify a target build stage.

```console
$ docker build --target build -t hello .
```

Source: [Docker Docs — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/), section "Stop at a specific build stage"

### Use an external image as a stage

> When using multi-stage builds, you aren't limited to copying from stages you created earlier in your Dockerfile. You can use the `COPY --from` instruction to copy from a separate image.

```dockerfile
COPY --from=nginx:latest /etc/nginx/nginx.conf /nginx.conf
```

Source: [Docker Docs — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/), section "Use an external image as a stage"

### BuildKit skips unrelated stages

> BuildKit only builds the stages that the target stage depends on.

Given:
```dockerfile
FROM ubuntu AS base
RUN echo "base"

FROM base AS stage1
RUN echo "stage1"

FROM base AS stage2
RUN echo "stage2"
```

Building `stage2` with BuildKit processes only `base` and `stage2`. The legacy builder processes all stages unconditionally.

Source: [Docker Docs — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/), section "Differences between legacy builder and BuildKit"

### Create reusable stages

> If you have multiple images with a lot in common, consider creating a reusable stage that includes the shared components, and basing your unique stages on that. Docker only needs to build the common stage once. This means that your derivative images use memory on the Docker host more efficiently and load more quickly.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Create reusable stages"

---

## 4. .dockerignore

### Purpose

> You can use a `.dockerignore` file to exclude files or directories from the build context. This helps avoid sending unwanted files and directories to the builder, improving build speed, especially when using a remote builder.

Source: [Docker Docs — Build context](https://docs.docker.com/build/concepts/context/), section ".dockerignore files"

### How it works

> When you run a build command, the build client looks for a file named `.dockerignore` in the root directory of the context. If this file exists, the files and directories that match patterns in the files are removed from the build context before it's sent to the builder.

Source: [Docker Docs — Build context](https://docs.docker.com/build/concepts/context/), section ".dockerignore files"

### What to exclude

> Some examples of things you might want to add to your `.dockerignore` file are:
> - `.git` — skip sending the version control history in the build context.
> - Directories containing build artifacts, such as binaries.
> - Vendor directories for package managers, such as `node_modules`.
>
> In general, the contents of your `.dockerignore` file should be similar to what you have in your `.gitignore`.

Source: [Docker Docs — BuildCloud optimization](https://docs.docker.com/build-cloud/optimization/), section "Dockerignore files"

> The easiest way to make sure your context doesn't include unnecessary files is to create a `.dockerignore` file in the root of your build context.
>
> Ignore-rules specified in the `.dockerignore` file apply to the entire build context, including subdirectories.

Source: [Docker Docs — Optimize cache usage in builds](https://docs.docker.com/build/cache/optimize/), section "Keep the context small"

### Legacy builder vs BuildKit

> When using the legacy builder, the build context is sent over to the daemon in its entirety. With BuildKit, only the files you use in your builds are transmitted. The legacy builder doesn't calculate which files it needs beforehand. This means that for builds with a large context, context transfer can take a long time, even if you're only using a subset of the files included in the context.

Source: [Docker Docs — docker image build (legacy)](https://docs.docker.com/reference/cli/docker/image/build/), section "Build context with the legacy builder"

### .dockerignore syntax (key rules)

| Rule | Behavior |
| :--- | :------- |
| `# comment` | Ignored. |
| `*/temp*` | Exclude files starting with `temp` in any immediate subdirectory of the root. |
| `**/*.go` | Exclude all `.go` files anywhere in the build context (Docker extension beyond Go's `filepath.Match`). |
| `!` prefix | Make exceptions to exclusions. The last matching line determines inclusion. |

Source: [Docker Docs — Build context](https://docs.docker.com/build/concepts/context/), section ".dockerignore files"

---

## 5. `--mount=type=cache` and BuildKit

### Official definition

> This mount type allows the build container to cache directories for compilers and package managers.
>
> Contents of the cache directories persists between builder invocations without invalidating the instruction cache. Cache mounts should only be used for better performance. Your build should work with any contents of the cache directory as another build may overwrite the files or GC may clean it if more storage space is needed.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "RUN --mount=type=cache"

### Cache mounts are cumulative across builds

> Cache mounts are a way to specify a persistent cache location to be used during builds. The cache is cumulative across builds, so you can read and write to the cache multiple times. This persistent caching means that even if you need to rebuild a layer, you only download new or changed packages. Any unchanged packages are reused from the cache mount.

Source: [Docker Docs — Optimize cache usage in builds](https://docs.docker.com/build/cache/optimize/), section "Use cache mounts"

### npm example

```dockerfile
RUN --mount=type=cache,target=/root/.npm npm install
```

> In this example, the `npm install` command uses a cache mount for the `/root/.npm` directory, the default location for the npm cache. The cache mount is persisted across builds, so even if you end up rebuilding the layer, you only download new or changed packages.

Source: [Docker Docs — Optimize cache usage in builds](https://docs.docker.com/build/cache/optimize/), section "Use cache mounts"

### apt example with sharing=locked

```dockerfile
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt update && apt-get --no-install-recommends install -y gcc
```

> Apt needs exclusive access to its data, so the caches use the option `sharing=locked`, which will make sure multiple parallel builds using the same cache mount will wait for each other and not access the same cache files at the same time.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "RUN --mount=type=cache"

### Cache mount options

| Option | Description |
| ------ | ----------- |
| `id` | Optional ID to identify separate/different caches. Defaults to value of `target`. |
| `target` (also `dst`, `destination`) | Mount path. |
| `sharing` | One of `shared`, `private`, or `locked`. Defaults to `shared`. |
| `from` | Build stage, context, or image name to use as a base of the cache mount. Defaults to empty directory. |
| `source` | Subpath in the `from` to mount. Defaults to the root of the `from`. |
| `mode` | File mode for new cache directory in octal. Default `0755`. |

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "RUN --mount=type=cache"

### Bind mounts (more efficient than COPY for intermediate files)

> Bind mounts are more efficient than `COPY` for including files from the build context in the container. Note that bind-mounted files are only added temporarily for a single `RUN` instruction, and don't persist in the final image.
>
> The `COPY` and `ADD` instructions in a Dockerfile lets you copy files from the build context into the build container. Using bind mounts is beneficial for build cache optimization because you're not adding unnecessary layers to the cache.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "ADD or COPY"

---

## 6. Minimizing Layers

### What the docs actually say

> Split long or complex `RUN` statements on multiple lines separated with backslashes to make your Dockerfile more readable, understandable, and maintainable.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Run pip install ..."

### Chain commands with &&

> For example, you can chain commands with the `&&` operator, and use escape characters to break long commands into multiple lines.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Run pip install ..."

### Use here documents (heredocs) for multi-line RUN

```dockerfile
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends \
    package-bar \
    package-baz \
    package-foo
EOF
```

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/)

### Combine apt-get update and install in one RUN

> Using `RUN apt-get update && apt-get install -y --no-install-recommends` ensures your Dockerfile installs the latest package versions with no further coding or manual intervention. This technique is known as cache busting.

> In addition, when you clean up the apt cache by removing `/var/lib/apt/lists` it reduces the image size, since the apt cache isn't stored in a layer.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "Run apt-get update and apt-get install in the same RUN statement"

### ENV creates layers

> Each `ENV` line creates a new intermediate layer, just like `RUN` commands. This means that even if you unset the environment variable in a future layer, it still persists in this layer and its value can be dumped.

> To prevent this and unset the environment variable, use a `RUN` command with shell commands, to set, use, and unset the variable all in a single layer.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "ENV"

### Avoid switching USER back and forth

> Lastly, to reduce layers and complexity, avoid switching `USER` back and forth frequently.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "USER"

### Prior to Docker 1.10: combine LABELs (no longer necessary)

> Prior to Docker 1.10, it was recommended to combine all labels into a single `LABEL` instruction, to prevent extra layers from being created. This is no longer necessary, but combining labels is still supported.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "LABEL"

The Dockerfile reference confirms:

> An image can have more than one label. You can specify multiple labels on a single line. Prior to Docker 1.10, this decreased the size of the final image, but this is no longer the case.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "LABEL"

---

## 7. Security Best Practices

### Use COPY instead of ADD (unless you need ADD's special features)

> `ADD` and `COPY` are functionally similar. `COPY` supports basic copying of files into the container, from the build context or from a stage in a multi-stage build. `ADD` supports features for fetching files from remote HTTPS and Git URLs, and extracting tar files automatically when adding files from the build context.

> You'll mostly want to use `COPY` for copying files from one stage to another in a multi-stage build.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "ADD or COPY"

### Run as non-root user (USER directive)

> If a service can run without privileges, use `USER` to change to a non-root user. Start by creating the user and group in the Dockerfile.

```dockerfile
RUN groupadd -r postgres && useradd --no-log-init -r -g postgres postgres
```

> Consider an explicit UID/GID. Users and groups in an image are assigned a non-deterministic UID/GID in that the "next" UID/GID is assigned regardless of image rebuilds. So, if it's critical, you should assign an explicit UID/GID.

> Due to an unresolved bug in the Go archive/tar package's handling of sparse files, attempting to create a user with a significantly large UID inside a Docker container can lead to disk exhaustion because `/var/log/faillog` in the container layer is filled with NULL (\0) characters. A workaround is to pass the `--no-log-init` flag to `useradd`.

> Avoid installing or using `sudo` as it has unpredictable TTY and signal-forwarding behavior that can cause problems.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "USER"

### HEALTHCHECK

> The `HEALTHCHECK` instruction tells Docker how to test a container to check that it is still working. This can detect cases such as a web server that is stuck in an infinite loop and cannot handle new connections, even though the server process is still running.

The HEALTHCHECK format:

```dockerfile
HEALTHCHECK [OPTIONS] CMD command
```

Options: `--interval=DURATION` (default: 30s), `--timeout=DURATION` (default: 30s), `--start-period=DURATION` (default: 0s), `--retries=N` (default: 3).

> The command's exit status indicates the container's health status: 0 = healthy, 1 = unhealthy, 2 = reserved.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "HEALTHCHECK"

### Additional security guidance from Docker Hardened Images docs

> Base image hardening is the process of securing the foundational layers of a container image by minimizing what they include and configuring them with security-first defaults. A hardened base image removes unnecessary components, like shells, compilers, and package managers, which limits the available attack surface, making it more difficult for an attacker to gain control or escalate privileges inside the container.

Source: [Docker Docs — Docker Hardened Images](https://docs.docker.com/dhi/core-concepts/hardening/), section "Base image hardening"

### The Dockerfile reference on USER

> The `USER` instruction sets the user name (or UID) and optionally the user group (or GID) to use as the default user and group for the remainder of the current stage. The specified user is used for `RUN` instructions and at runtime, runs the relevant `ENTRYPOINT` and `CMD` commands.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "USER"

---

## 8. Squashing Layers (`--squash`)

### Status: experimental, with known drawbacks

> The `--squash` option is an experimental feature, and should not be considered stable.

Source: [Docker Docs — docker image build](https://docs.docker.com/reference/cli/docker/image/build/), section "Squash an image's layers (--squash) (experimental)"

### How it works

> Once the image is built, this flag squashes the new layers into a new image with a single new layer. Squashing doesn't destroy any existing image, rather it creates a new image with the content of the squashed layers.

> The `--squash` flag preserves the build cache.

### Known limitations

> - When squashing layers, the resulting image can't take advantage of layer sharing with other images, and may use significantly more space. Sharing the base image is still supported.
> - When using this option you may see significantly more space used due to storing two copies of the image, one for the build cache with all the cache layers intact, and one for the squashed version.
> - While squashing layers may produce smaller images, it may have a negative impact on performance, as a single layer takes longer to extract, and you can't parallelize downloading a single layer.
> - When attempting to squash an image that doesn't make changes to the filesystem (for example, the Dockerfile only contains `ENV` instructions), the squash step will fail.

Source: [Docker Docs — docker image build](https://docs.docker.com/reference/cli/docker/image/build/), section "Squash an image's layers (--squash) (experimental)"

### Docker's position

The docs do not recommend `--squash` as a general practice. The feature is experimental, and the documented limitations (no layer sharing, worse pull performance, double disk space) make it a poor choice for most use cases. The official best-practices guide never mentions `--squash`. Multi-stage builds are the recommended approach for reducing final image size.

---

## 9. `COPY . .` vs Targeted COPY

### Why targeted COPY is better

The canonical example from the cache optimization guide:

```dockerfile
# Avoid this: any change invalidates all downstream layers
COPY . .
RUN npm install
RUN npm build

# Instead: copy dependencies first, install, then copy source
COPY package.json yarn.lock .
RUN npm install
COPY . .
RUN npm build
```

> By installing dependencies in earlier layers of the Dockerfile, there is no need to rebuild those layers when a project file has changed.

Source: [Docker Docs — Optimize cache usage in builds](https://docs.docker.com/build/cache/optimize/), section "Order your layers"

### Context size affects build performance

> The context is the set of files and directories that are sent to the builder to process a build instruction. Keeping the context as small as possible reduces the amount of data that needs to be sent to the builder, and reduces the likelihood of cache invalidation.

Source: [Docker Docs — Optimize cache usage in builds](https://docs.docker.com/build/cache/optimize/), section "Keep the context small"

### Use bind mounts instead of COPY for intermediate build files

> Bind mounts are more efficient than `COPY` for including files from the build context in the container. Note that bind-mounted files are only added temporarily for a single `RUN` instruction, and don't persist in the final image. If you need to include files from the build context in the final image, use `COPY`.

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "ADD or COPY"

### Cache checksum for COPY

> For the `ADD` and `COPY` instructions, the builder calculates a cache checksum from file metadata to determine whether cache is valid. During cache lookup, cache is invalidated if the file metadata has changed for any of the files involved.

Source: [Docker Docs — Build cache invalidation](https://docs.docker.com/build/cache/invalidation/), section "General rules"

---

## 10. Image Tagging and Labels (`LABEL` instruction)

### Official definition

> The `LABEL` instruction adds metadata to an image. A `LABEL` is a key-value pair.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "LABEL"

### Label format and escaping

```dockerfile
# Set one or more individual labels
LABEL com.example.version="0.0.1-beta"
LABEL vendor1="ACME Incorporated"
LABEL vendor2=ZENITH\ Incorporated
LABEL com.example.release-date="2015-02-12"
LABEL com.example.version.is-production=""

# Set multiple labels on one line
LABEL com.example.version="0.0.1-beta" com.example.release-date="2015-02-12"

# Set multiple labels using line-continuation
LABEL vendor=ACME\ Incorporated \
      com.example.is-beta= \
      com.example.is-production="" \
      com.example.version="0.0.1-beta" \
      com.example.release-date="2015-02-12"
```

Source: [Docker Docs — Building best practices](https://docs.docker.com/build/building/best-practices/), section "LABEL"

### Quoting rules

> Be sure to use double quotes and not single quotes. Particularly when you are using string interpolation (e.g. `LABEL example="foo-$ENV_VAR"`), single quotes will take the string as is without unpacking the variable's value.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "LABEL"

### Label inheritance

> Labels included in base images (images in the `FROM` line) are inherited by your image. If a label already exists but with a different value, the most-recently-applied value overrides any previously-set value.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "LABEL"

### Labels in multi-stage builds

> In a multi-stage build, labels from intermediate stages are only present in the final image if the final stage is directly or indirectly based on them (via `FROM`). Labels from a stage that you only reference with `COPY --from` or `RUN --mount=from=` are not included in the output image. Labels from the base image specified in the final `FROM` instruction are always inherited.

Source: [Docker Docs — Dockerfile reference](https://docs.docker.com/reference/dockerfile/), section "LABEL"

### `MAINTAINER` is deprecated — use `LABEL` instead

> The `MAINTAINER` instruction, used historically for specifying the author of the Dockerfile, is deprecated. To set author metadata for an image, use the `org.opencontainers.image.authors` OCI label.

```dockerfile
# Bad (deprecated)
MAINTAINER moby@example.com

# Good
LABEL org.opencontainers.image.authors="moby@example.com"
```

Source: [Docker Docs — Build checks: MAINTAINER deprecated](https://docs.docker.com/reference/build-checks/maintainer-deprecated/)

### Label key conventions (from Docker object labels)

> - Authors of third-party tools should prefix each label key with the reverse DNS notation of a domain they own, such as `com.example.some-label`.
> - The `com.docker.*`, `io.docker.*`, and `org.dockerproject.*` namespaces are reserved by Docker for internal use.
> - Label keys should begin and end with a lower-case letter and should only contain lower-case alphanumeric characters, the period character (`.`), and the hyphen character (`-`).

Source: [Docker Docs — Docker object labels](https://docs.docker.com/engine/manage-resources/labels/), section "Label key and value guidelines"

### OCI Annotations (beyond labels)

> Annotations provide descriptive metadata for images. Use annotations to record arbitrary information and attach it to your image, which helps consumers and tools understand the origin, contents, and how to use the image.

> Annotations describe OCI image components, such as manifests, indexes, and descriptors. Labels describe Docker resources, such as images, containers, networks, and volumes.

Pre-defined OCI annotation keys include:
- `org.opencontainers.image.authors`
- `org.opencontainers.image.created`
- `org.opencontainers.image.description`
- `org.opencontainers.image.documentation`
- `org.opencontainers.image.licenses`
- `org.opencontainers.image.ref.name`
- `org.opencontainers.image.revision`
- `org.opencontainers.image.source`
- `org.opencontainers.image.title`
- `org.opencontainers.image.url`
- `org.opencontainers.image.vendor`
- `org.opencontainers.image.version`

Source: [Docker Docs — Annotations](https://docs.docker.com/build/metadata/annotations/), section "Annotations"

---

## Summary of Recommended Changes for the Project's Dockerfile

| Topic | Current State | Recommended Improvement |
|-------|--------------|------------------------|
| Base image | `node:24-alpine` | ✅ Already good — pinned, minimal, official. Consider pinning to digest for supply-chain integrity. |
| Layer ordering | COPY package files, then `npm ci`, then COPY all | ✅ Already good. |  |
| Multi-stage | deps → builder → runner + migrator | ✅ Good structure. Stages are named. |
| Cache mounts | `--mount=type=cache,target=/root/.npm` | ✅ Already used for `npm ci`. |
| Bind mounts | Not used | Optional: use `--mount=type=bind` to mount `package.json`/`package-lock.json` instead of COPY for the deps stage. |
| .dockerignore | Exists but can be expanded | Add coverage/, .github/, *.tsbuildinfo, OS files, debug logs, CI config. |
| Minimizing layers | Already reasonable | Single ENV lines could be combined. |
| Security | `USER nextjs`, `HEALTHCHECK` | ✅ Already good. Consider adding `--no-log-init` to `adduser`. |
| `--squash` | Not used | ✅ Do not use — experimental, harms layer sharing and pull performance. |
| Labels | None | Add `org.opencontainers.image.*` labels for provenance. |
| COPY . . | Used in builder stage | ✅ Appropriate (needs all source for build). Consider more targeted COPY if build structure allows. |
