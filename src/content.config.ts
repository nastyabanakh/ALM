import { defineCollection } from 'astro:content';
import { collectionSchemas } from '../cms/model.mjs';
import { cmsJsonLoader } from '../cms/json-loader.mjs';

export const collections = {
  pages: defineCollection({
    loader: cmsJsonLoader('pages'),
    schema: collectionSchemas.pages
  }),
  posts: defineCollection({
    loader: cmsJsonLoader('posts'),
    schema: collectionSchemas.posts
  }),
  projects: defineCollection({
    loader: cmsJsonLoader('projects'),
    schema: collectionSchemas.projects
  })
};
