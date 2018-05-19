# Testing Concept

## Notes

* pure text search approach doesn't work because we might want to press an icon
* simple class approach would require us to make changes to the code. it couples the tests tighter to the code
* component selectors seem like the way to go

## Ideal API

```
const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.goto(CHECKOUT_URL)

const $ = await mkResell(page).toPromise()

$('Link[children="Order.login-label"]').click()
$('Input[label="Login.username"]').type('test-user@vimcar.com')
$('Input[label="Login.password"]').type('super secret!')
$('Button[children="Login.login"]').click()

const header = await $.waitFor('Header2').toPromise()
expect(header).toHaveTextContent('Order.welcome')
```

## Implementation Concept

`resell-select` is a package that parses CSS selectors and selects rendered React nodes based on those. At first it can be pretty basic. It just needs to support the features used above. Later we can extend  it to support a bigger subset of CSS selectors.

`resell` will wrap `pupeteer` and `resell-select`. After initialization it will execute queries inside chrome headless. It will then take a DOM node out of that and pass it as a handle to the test runtime. Inside the test runtime it will then do manipulations based on that handle.

The initialization process is a bit tricky. Resell will create an instance of `resell-select` inside the chrome headless JS runtime and write it into some global. Later it will always access that global to query the component tree.

One more challenge is injecting the `resell-select` code into the headless runtime. This be done using pupeteer's `page.evaluate()` method. We can pass a self-contained factory function to it, on which we call `Function.prototype.toString()`. That imposes one huge restriction though. We cannot use any external dependencies. So we can also not use a library to parse our selectors.

Resell's API hides a lot of complexity. Especially with handling asyncronous actions. All interactions with Resell are asynchronous, since it always needs to make a call to `page.evaluate()`. To achive the API above we use a little trick. Whenever we make a call to Resell, a command is pushed to an internal queue and a Rxjs Observable is returned. When you subscribe to such an observable, it will run all commands in the queue and emit the value emitted by the last command.
