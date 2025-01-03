#!/bin/sh

cd archive-server && git reset --hard HEAD
git checkout origin/itn4
cd ..
node clean1.js archive-server
#cp archive-server.patch archive-server
#cd archive-server
#git apply archive-server.patch
#cd ..

cd core && git reset --hard HEAD
git checkout origin/itn4-1.16.2
cd ..
node clean1.js core
cp core.patch core
cd core
git apply core.patch
cd ..


cd server && git reset --hard HEAD
git checkout origin/itn4-1.16.2
cd ..
node clean1.js server
cp server.patch server
cd server
git apply server.patch
cd ..
