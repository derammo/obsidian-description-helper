# Description Helper Plugin

Uses OpenAI to generate additional descriptive terms and drawings to help quickly and interactively define an NPC for TTRPG.

This is intended to be used together with a Template (e.g. Templater) plugin to create new pages quickly and then interactively work on them using a combination of text and UI, with all state stored in the page itself.

Not yet generalized for other use cases, since some of the input is hard coded and not yet configurable.

![Demo](./description_helper.gif)

Requires https://github.com/derammo/obsidian-knowntags

Requires https://openai.com API key (**the kind that costs money**)

# Common: meta data in known tags information

```
---
derammo-known-tags:
 wealth/rich: {}
 wealth/comfortable:
  image:
   prompt: financially stable
  text:
   prompt: financially stable
 wealth/poor: {}
---
```

Metadata is used to override the default prompt text (e.g. `rich`) for tags that need different wording to work well with the text and/or image AI.

# Command: character-random-description

```
Description:

#tag/subtag
#tag/subtag
#tag/subtag

> descriptive text
> descriptive text
...

`!character-random-description`
```

Operates as shown in demo above.

# Command: image-prompt-from-tags

```
Description:

#tag/subtag
#tag/subtag
#tag/subtag

> descriptive text
> descriptive text
...

> `!image-prompt-from-tags`
```

Operates as shown in demo above.

# Command: image-set

Helper command used to store the prompt that was used for a set of images and to provide a quick button to delete an entire set (line in the markdown file.)  Added automatically when `!image_prompt_from_tags` downloads a set of images.

# Installation

Download submodules and install dependencies:

`npm install`

Build plugin and copy latest version to demo vault in `examples` folder.

`npm run update-examples`
