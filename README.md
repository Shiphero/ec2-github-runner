# On-demand self-hosted AWS EC2 runner for GitHub Actions - Shiphero's Fork

Our fork of the [machulav/ec2-github-runner](https://github.com/machulav/ec2-github-runner) for 
the horizontally scaled CI runner of app-endpoints. 

Check the [internal docs](https://docs.shiphero.xyz/ci.html#horizontally-scaled-runners).


## Changes from the original

- Includes [#165](https://github.com/machulav/ec2-github-runner/pull/165): "Allow providing ec2-instance-count to start multiple runners"
  
  We need several instances one for each portion. 

- A [workaround](https://github.com/machulav/ec2-github-runner/issues/60#issuecomment-1776102925) for [#60](https://github.com/machulav/ec2-github-runner/issues/60): "Support multiple regions/availabilty zones if an instance type cannot be started" 

  This minimizes the chance of the `InsufficientInstanceCapacity` error, by balancing and trying 
  subnetworks in different subzones

- <strike>[Reduce the waiting and polling intervals](https://github.com/Shiphero/ec2-github-runner/blob/97e4566a338e61490ce0a5b944e62801041faccb/src/gh.js#L63) for the runners registering. 

  This allows to save around 45' on the "start" step. </strike>

  Reverted in [5659035ee505](https://github.com/Shiphero/ec2-github-runner/commit/5659035ee5055b3c32cd4d104ccfa339472250b0) because we were hitting Github's rate limit for personal tokens.

- [Increases the page size when listing runners](https://github.com/Shiphero/ec2-github-runner/pull/2/commits/e3aae63b6a8bd136b0fd9460468dc85097a8d273) to reduce the number or requests to Github API. 

- [Avoid failures when other runners are already registered with same name](https://github.com/Shiphero/ec2-github-runner/pull/4) by assigning a random name to the instances. 

- [Support for using spot instances](https://github.com/machulav/ec2-github-runner/pull/171)
