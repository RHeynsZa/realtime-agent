## Decisions

### TypeScript 

I chose TypeScript because it is a statically typed language that helps catch errors at compile time, also AI agents get a lot more mileage out of reading linting errors than runtime errors.

### Global Claude config

My global Claude config is in my home directory, I dont have a lot there, but the most important line is:
```
As a code reviewer, criticize the first plan you come up with. Check existing codebase convention and libraries, and see if the plan can be improved
```

### Testing

I chose Vitest because it is a fast and easy to use testing framework for TypeScript. It is also built on top of Jest, so it is very familiar and easy to use.

Having the ability to run tests without a running server is a huge bonus. But, being able to also run tests against a live server (integration tests) is even better.

### Message ID

Ive worked with websockets before, and anyone that does, knows that message ids are crucial. Not sure if thats a decision, just thought I'd mention it.
