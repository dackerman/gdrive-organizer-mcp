# [ ] 1. Convert the google-drive service to be closer to the API itself

I want the Google Drive service to just very closely match the API, but with types. This way,
we don't need so many real integration tests to verify its correctness (becuause there isn't much application-specific behavior embedded in it), and it's easier to audit.

Then, the business logic will call and combine these endpoints as needed, and we can test it by making a stub version of Google drive so the tests are fast and deterministic. We can make sure our logic works without needing the complexity of hitting a real API.

For example, we should just expose the following Google Drive API v3 endpoints:

- list
- get
- update

We should also just define a good typescript type for File which matches the API so we can easily work with it in business logic code.

# [ ] 2. Simplify tools to let the LLM filter and control the data it sees more simply

We want to minimize context that the LLM needs to have to interact with the drive api, so we want to expose a flexible and simple interface.

We should remove the directory and file tree tools.

for list_directory, we should let the LLM decide which fields to return

Also let's add a lot more documentation to all the tool fields so that the LLM can figure out how to use it properly.

In particular, the "q" parameter is very complex. there's documentation on how this works here: https://developers.google.com/workspace/drive/api/guides/search-files

we should include as much context as we can so that the LLM can figure out this query
