## Log Normalizer 
[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/interfasys/lognormalizer/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/interfasys/lognormalizer/?branch=master)
[![Code Climate](https://codeclimate.com/github/interfasys/lognormalizer/badges/gpa.svg)](https://codeclimate.com/github/interfasys/lognormalizer)
[![Build Status](https://travis-ci.org/interfasys/lognormalizer.svg?branch=master)](https://travis-ci.org/interfasys/lognormalizer)
[![Code Coverage](https://scrutinizer-ci.com/g/interfasys/lognormalizer/badges/coverage.png?b=master)](https://scrutinizer-ci.com/g/interfasys/lognormalizer/?branch=master)

Parses variables and converts them to string so that they can be logged

Based on the [Monolog](https://github.com/Seldaek/monolog) formatter/normalizer.

## How to use

### Initialisation in your class

```php
use InterfaSys\LogNormalizer\Normalizer;

$normalizer = new Normalizer();
```

The constructor supports the following optional arguments

* `int $maxRecursionDepth`: The maximum depth at which you want to go in objects and arrays
* `int $maxArrayItems`: The maximum number of elements you want to show, when parsing an array or an object
* `string $dateFormat`: The format to apply to dates

### Format variables before logging them

This is what your logging function could look like

```php
/**
 * Converts the variables in the received log message to string before
 * sending everything to the real logger
 *
 * @param string $level
 * @param string $message
 * @param array $variables
 *
 * @return mixed
 */
public function log($level, $message, array $variables= []) {
	array_walk($variables, [$this->normalizer, 'format']);
	
	// Then use your current PSR-3 compatible logging system
	$this->logger->log($level, $message, $variables);
}
```	

And you would call it like this from another class

```php
$myLogger->log('debug',
	'Logger test {var1}, {var2}',
	[
		'var1' => $var1,
		'var2' => $var2
		]
);
```

### Convert a single variable to a string

```php
$normalizedVariable = $this->normalizer->format($variable);
```
