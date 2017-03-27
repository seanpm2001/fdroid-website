---
layout: page
permalink: /manual/
description: 'F-Droid Server Manual'
keywords: 'F-Droid Server Manual'
title: 'F-Droid Server Manual'
---

## 2 System Requirements<a name="System-Requirements"></a>


The system requirements for using the tools will vary depending on your
intended usage. At the very least, you’ll need:

-   GNU/Linux
-   Python 3.4 or later
-   The Android SDK Tools and Build-tools. Note that F-Droid does not
    assume that you have the Android SDK in your `PATH`: these
    directories will be specified in your repository configuration.
    Recent revisions of the SDK have `aapt` located in
    android-sdk/build-tools/ and it may be necessary to make a symlink
    to it in android-sdk/platform-tools/

If you intend to build applications from source you’ll also need most,
if not all, of the following:

-   JDK (Debian package openjdk-6-jdk): openjdk-6 is recommended though
    openjdk-7 should work too
-   VCS clients: svn, git, git-svn, hg, bzr
-   A keystore for holding release keys. (Safe, secure and well
    backed up!)

If you intend to use the ’Build Server’ system, for secure and clean
builds (highly recommended), you will also need:

-   VirtualBox (debian package virtualbox)
-   Ruby (debian packages ruby and rubygems)
-   Vagrant (debian package vagrant - 1.4.x or higher required)
-   vagrant-cachier plugin (unpackaged): ‘vagrant plugin install
    vagrant-cachier‘
-   Paramiko (debian package python-paramiko)
-   Imaging (debian package python-imaging)

On the other hand, if you want to build the apps directly on your system
without the ’Build Server’ system, you may need:

-   A version of the Android NDK
-   Ant with Contrib Tasks (Debian packages ant and ant-contrib)
-   Maven (Debian package maven)
-   JavaCC (Debian package javacc)
-   Miscellaneous packages listed in
    buildserver/cookbooks/fdroidbuild-general/recipes/default.rb of the
    F-Droid server repository


## 3 Setup<a name="Setup"></a>


Because the tools and data will always change rapidly, you will almost
certainly want to work from a git clone of the tools at this stage. To
get started:

```
git clone https://gitlab.com/fdroid/fdroidserver.git
```

You now have lots of stuff in the fdroidserver directory, but the most
important is the ’fdroid’ command script which you run to perform all
tasks. This script is always run from a repository data directory, so
the most sensible thing to do next is to put your new fdroidserver
directory in your `PATH`.


## 4 Simple Binary Repository<a name="Simple-Binary-Repository"></a>

If you want to maintain a simple repository hosting only binary APKs
obtained and compiled elsewhere, the process is quite simple:

1.  Set up the server tools, as described in Setup.
2.  Make a directory for your repository. This is the directory from
    which you will do all the work with your repository. Create a config
    file there, called `config.py`, by copying `./examples/config.py`
    from the server project and editing it.
3.  Within that, make a directory called `repo` and put APK files in it.
4.  Run `fdroid update`.
5.  If it reports that any metadata files are missing, you can create
    them in the `metadata` directory and run it again.
6.  To ease creation of metadata files, run `fdroid update` with the
    `-c` option. It will create ’skeleton’ metadata files that are
    missing, and you can then just edit them and fill in the details.
7.  Then, if you’ve changed things, run `fdroid update` again.
8.  Running `fdroid update` adds an Icons directory into the repo
    directory, and also creates the repository index (index.xml, and
    also index.jar if you’ve configured the system to use a
    signed index).
9.  Publish the resulting contents of the `repo` directory to your
    web server.

Following the above process will result in a `repo` directory, which you
simply need to push to any HTTP (or preferably HTTPS) server to make it
accessible.

While some information about the applications (and versions thereof) is
retrieved directly from the APK files, most comes from the corresponding
file in the `metadata` directory. The metadata file covering ALL
versions of a particular application is named `package.id.txt` where
package.id is the unique identifier for that package.

See the Metadata chapter for details of what goes in the metadata file.
All fields are relevant for binary APKs, EXCEPT for `Build:` entries,
which should be omitted.




## 9 Build Server<a name="Build-Server"></a>

The Build Server system isolates the builds for each package within a
clean, isolated and secure throwaway virtual machine environment.


### 9.1 Overview<a name="Overview-2"></a>

Building applications in this manner on a large scale, especially with
the involvement of automated and/or unattended processes, could be
considered a dangerous pastime from a security perspective. This is even
more the case when the products of the build are also distributed widely
and in a semi-automated ("you have updates available") fashion.

Assume that an upstream source repository is compromised. A small
selection of things that an attacker could do in such a situation:

1.  Use custom Ant build steps to execute virtually anything as the user
    doing the build.
2.  Access the keystore.
3.  Modify the built apk files or source tarballs for other applications
    in the repository.
4.  Modify the metadata (which includes build scripts, which again, also
    includes the ability to execute anything) for other applications in
    the repository.

Through complete isolation, the repurcussions are at least limited to
the application in question. Not only is the build environment fresh for
each build, and thrown away afterwards, but it is also isolated from the
signing environment.

Aside from security issues, there are some applications which have
strange requirements such as custom versions of the NDK. It would be
impractical (or at least extremely messy) to start modifying and
restoring the SDK on a multi-purpose system, but within the confines of
a throwaway single-use virtual machine, anything is possible.

All this is in addition to the obvious advantage of having a
standardised and completely reproducible environment in which builds are
made. Additionally, it allows for specialised custom build environments
for particular applications.


### 9.2 Setting up a build server<a name="Setting-up-a-build-server"></a>

In addition to the basic setup previously described, you will also need
a Vagrant-compatible Debian Testing base box called ’jessie64’.

You can use a different version or distro for the base box, so long as
you don’t expect any help making it work. One thing to be aware of is
that working copies of source trees are moved from the host to the
guest, so for example, having subversion v1.6 on the host and v1.7 on
the guest would fail.


#### 9.2.1 Creating the Debian base box<a name="Creating-the-Debian-base-box"></a>

The output of this step is a minimal Debian VM that has support for
remote login and provisioning.

Unless you’re very trusting, you should create one of these for yourself
from verified standard Debian installation media. However, by popular
demand, the `makebuildserver` script will automatically download a
prebuilt image unless instructed otherwise. If you choose to use the
prebuilt image, you may safely skip the rest of this section.

Documentation for creating a base box can be found at
<https://www.vagrantup.com/docs/boxes/base.html>.

In addition to carefully following the steps described there, you should
consider the following:

1.  It is advisable to disable udev network device persistence,
    otherwise any movement of the VM between machines, or
    reconfiguration, will result in broken networking.

    For a Debian/Ubuntu default install, just
    `touch /etc/udev/rules.d/75-persistent-net-generator.rules` to turn
    off rule generation, and at the same time, get rid of any rules it’s
    already created in `/etc/udev/rules.d/70-persistent-net.rules`.

2.  Unless you want the VM to become totally inaccessible following a
    failed boot, you need to set `GRUB_RECORDFAIL_TIMEOUT` to a value
    other than -1 in `/etc/grub/default` and then run `update-grub`.


#### 9.2.2 Creating the F-Droid base box<a name="Creating-the-F-Droid-base-box"></a>

The next step in the process is to create `makebs.config.py`, using
`./examples/makebs.config.py` as a reference - look at the settings and
documentation there to decide if any need changing to suit your
environment. There is a path for retrieving the base box if it doesn’t
exist, and an apt proxy definition, both of which may need customising
for your environment. You can then go to the `fdroidserver` directory
and run this:

```
./makebuildserver
```

This will take a long time, and use a lot of bandwidth - most of it
spent installing the necessary parts of the Android SDK for all the
various platforms. Luckily you only need to do it occasionally. Once you
have a working build server image, if the recipes change (e.g. when
packages need to be added) you can just run that script again and the
existing one will be updated in place.

The main sdk/ndk downloads will automatically be cached to speed things
up the next time, but there’s no easy way of doing this for the longer
sections which use the SDK’s `android` tool to install platforms,
add-ons and tools. However, instead of allowing automatic caching, you
can supply a pre-populated cache directory which includes not only these
downloads, but also .tar.gz files for all the relevant additions. If the
provisioning scripts detect these, they will be used in preference to
running the android tools. For example, if you have
`buildserver/addons/cache/platforms/android-19.tar.gz` that will be used
when installing the android-19 platform, instead of re-downloading it
using `android update sdk --no-ui -t android-19`. It is possible to
create the cache files of this additions from a local installation of
the SDK including these:

```
cd /path/to/android-sdk/platforms
tar czf android-19.tar.gz android-19
mv android-19.tar.gz /path/to/buildserver/addons/cache/platforms/
```

If you have already built a buildserver it is also possible to get this
files directly from the buildserver:

```
vagrant ssh -- -C 'tar -C ~/android-sdk/platforms czf android-19.tar.gz android-19'
vagrant ssh -- -C 'cat ~/android-sdk/platforms/android-19.tar.gz' > /path/to/fdroidserver/buildserver/cache/platforms/android19.tar.gz
```

Once it’s complete you’ll have a new base box called ’buildserver’ which
is what’s used for the actual builds. You can then build packages as
normal, but with the addition of the `--server` flag to `fdroid build`
to instruct it to do all the hard work within the virtual machine.

The first time a build is done, a new virtual machine is created using
the ’buildserver’ box as a base. A snapshot of this clean machine state
is saved for use in future builds, to improve performance. You can force
discarding of this snapshot and rebuilding from scratch using the
`--resetserver` switch with `fdroid build`.