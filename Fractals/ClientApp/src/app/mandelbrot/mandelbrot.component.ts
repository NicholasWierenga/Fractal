import { Component, OnInit } from '@angular/core';
import { Point } from '../point';
import * as PlotlyJS from 'plotly.js-dist-min';
import { create, all, MathJsStatic, BigNumber } from 'mathjs';

@Component({
  selector: 'app-mandelbrot',
  templateUrl: './mandelbrot.component.html',
  styleUrls: ['./mandelbrot.component.css']
})

export class MandelbrotComponent implements OnInit {
  config: math.ConfigOptions = {
    epsilon: 1e-12,
    matrix: 'Matrix',
    number: 'BigNumber',
    precision: 32,
    predictable: false,
    randomSeed: null
  };
  math: MathJsStatic = create(all, this.config);
  // TODO: Add some logic to compare window value to determine window-dimension ratio. Then use that to determine
  // how many steps to take along the x and y axes so that the graph doesn't feel so rectangle-y like it does now.
  xWindowLower: string = "-2";
  xWindowUpper: string = ".5";
  yWindowLower: string = "-1.15";
  yWindowUpper: string = "1.15";
  secondPass: boolean = false; // Will be used in the future for a button on the front-end.
  xStepDistance!: BigNumber;
  yStepDistance!: BigNumber;
  plotlyChart: any;
  pointCount: number = 0;
  skippedCount: number = 0;
  iterationsSkipped: number = 0;
  pointsWithShortIterations: number = 0;
  pointsInSet: number = 0;
  neighboringPointsFound: number = 0;

  // Below act as controls for the resolution of the graph. x/ySteps affects the amount of points 
  // tested on the graph. neighborsToCheck is the amount of points near to any good point found
  // that will also be checked. timesToIterate is the maximum amount of times a point is iterated
  // to determine if it is in the set or not. Upping the value of any of these improves resolution,
  // but at the cost of performance.
  xSteps: number = 300;
  ySteps: number = 300;
  // TODO: Because neighboring points are so densely-packed, anything beyond 1 makes the edges look
  // blurry or 'washed-out' with the same color of points. These points should be tinier than normal.
  neighborsToCheck: number = 1;
  timesToIterate: number = 255;

  constructor() { } 

  createGraph(): void {
    let layout: Partial<PlotlyJS.Layout> = {
      xaxis: {
        range: [this.xWindowLower, this.xWindowUpper],
        showgrid: false,
        zeroline: false,
        //visible: false
      },
      yaxis: {range: [this.yWindowLower, this.yWindowUpper],
        showgrid: false,
        zeroline: false,
        //visible: false
      },
      showlegend: false,
      height: 600,
      width: 600,
      hovermode: false,
    };

    PlotlyJS.newPlot("plotlyChart", [this.getTrace([])], layout).then(() => {
      this.plotlyChart = document.getElementById('plotlyChart') as PlotlyJS.PlotlyHTMLElement;

      this.findTrace();

      this.addGraphListeners();
    });
  }

  // TODO: An issue occurs if the user selects before the graph is fully finished. I think the
  // fix for this was to disable dragmode in the layout along with the listeners. After the graph is
  // finished, then add those back in.
  // Adds a listener to the graph and finds the new points in the selected window.
  addGraphListeners(): void {
    let isMousedown: boolean = false;

    this.plotlyChart.addEventListener('mousedown', () => {
      isMousedown = true;
    });

    // Plotly uses its own set of listeners that is almost only for selecting points, so regular listeners sometimes don't
    // work. Originally, this was supposed to be only a mouseup event, which doesn't work on the graph.
    this.plotlyChart.addEventListener('mouseover', () => {
      if (isMousedown) {
        isMousedown = false;
        PlotlyJS.deleteTraces('plotlyChart', [0]);
        PlotlyJS.addTraces('plotlyChart', [this.getTrace([])]);

        this.xWindowLower = this.plotlyChart._fullLayout.xaxis.range[0];
        this.xWindowUpper = this.plotlyChart._fullLayout.xaxis.range[1];
        this.yWindowLower = this.plotlyChart._fullLayout.yaxis.range[0];
        this.yWindowUpper = this.plotlyChart._fullLayout.yaxis.range[1];
        
        this.findTrace();
      }
    });
  }

  getTrace(points: Point[]): Partial<PlotlyJS.PlotData> {
    var trace: Partial<PlotlyJS.PlotData> = {
      x: points.map(point => point.xcoord),
      y: points.map(point => point.ycoord),
      mode: 'markers',
      name: ``,
      marker: {
        color: points.map(point => `rgb(${point.zcoord}, ${point.zcoord}, ${point.zcoord})`),
        autocolorscale: false,
        size: 1.0,
        opacity: 1
      },
      type: 'scattergl'
    };

    return trace;
  }
  
  findTrace(): void {
    this.pointCount = 0;
    let count: number = 0;
    let points: Point[] = [];
    this.xStepDistance = this.math.bignumber(this.xWindowUpper).minus(this.math.bignumber(this.xWindowLower)).div(this.xSteps);
    this.yStepDistance = this.math.bignumber(this.yWindowUpper).minus(this.math.bignumber(this.yWindowLower)).div(this.ySteps);

    console.time('time to graph');

    // The setTimeouts are to give plotlyJS time to update the graph.
    for (let real: BigNumber = this.math.bignumber(this.xWindowLower); real.lessThanOrEqualTo(this.xWindowUpper); 
    real = real.plus(this.xStepDistance)) {
      setTimeout(() => {
        // This variable is used for when the program is looking through large chunks of the graph where all the points
        // are in the set. This slows the program down and we can be reasonably sure if the past several points were in the set,
        // then the next one is likely to be in there also. Because of this, the variable is used to cut down on the number of
        // iterations needed to be done when prior points have passed.
        let precedingPointsFound: number = 0;
        // Stores previous point in-set that is used to find points near to for when an out-of-set point is found.
        // Once it's been used, it is set back to undefined. While it is undefined, it is used to indicate to the program
        // when it found the end of out-of-set points and so it will find the neighboring points to that new in-set point.
        let previousInSetPoint: Point | undefined = undefined; 

        for (let imaginary: BigNumber = this.math.bignumber(this.yWindowLower); imaginary.lessThanOrEqualTo(this.yWindowUpper); 
        imaginary = imaginary.plus(this.yStepDistance)) {
          let iterationsPassed: number;

          if (precedingPointsFound >= 3) {
            iterationsPassed = this.vibeCheck(real.toString(), imaginary.toString(), precedingPointsFound);

            this.pointsWithShortIterations++;
          }
          else {
            iterationsPassed = this.vibeCheck(real.toString(), imaginary.toString());
          }

          // TODO: Try messing around with criteria for being in previousInSetPoint. Currently, a point has
          // to be in the set, but sometimes points are nearly in, and those could be useful to find neighbors for also.
          // Additionally, this could look like an if for some number near this.timesToIterate, but not this.timesToIterate.
          // this would mean previousInSetPoint doesn't need to be changed.

          let newPoint: Point = {xcoord: real.toString(), ycoord: imaginary.toString(), zcoord: iterationsPassed.toString()};

          // TODO: this.timesToIterate should be upped as the window becomes smaller.
          // This value can cause points to be passed when they shouldn't be and even without
          // that problem, looking near the 'edges' requires a greater amount of iterations regardless.
          if (iterationsPassed === this.timesToIterate) {
            precedingPointsFound++;
            this.pointsInSet++;

            // To find neighboring points of the first in-set point after any amount of out-of-set points.
            if (this.neighborsToCheck > 0 && previousInSetPoint === undefined) {
              points.push(...this.findNeighbors(newPoint));
            }

            previousInSetPoint = newPoint;
          }
          else {
            precedingPointsFound = 0;

            // To find neighboring points of the previous in-set point if we didn't already.
            if (this.neighborsToCheck > 0 && previousInSetPoint !== undefined) {
              points.push(...this.findNeighbors(previousInSetPoint));

              previousInSetPoint = undefined; // to prevent the same point being used again during a string of out-of-set points.
            }
          }

          points.push(newPoint);
        }

        count++;
        // This is so users don't sit and look at a blank graph until it pops in at once.
        if (count % this.math.floor(this.xSteps / 10) === 0 || this.isEqual(real, this.math.bignumber(this.xWindowUpper))) {
          this.pointCount += points.length;

          this.getGraph(points);

          points = [];

          console.log(`Total points: ${this.pointCount} with ${this.pointsInSet} in the set.`);
        }
      }, 0);
    }
    
    // Used only to keep track of performance and other data to be logged after all points are graphed.
    setTimeout(() => {
      console.timeEnd('time to graph');

      console.log (`Amount of neighboring points found: ${this.neighboringPointsFound}.`)
      this.neighboringPointsFound = 0;

      console.log(`Amount of points skipped due to precision-size limit: ${this.skippedCount}.`);
      this.skippedCount = 0;

      console.log(`Amount of iterations skipped due to precedingPointsFound logic: ${this.iterationsSkipped}.`);
      this.iterationsSkipped = 0;

      console.log(`Amount of points with a shorter than normal amount of iterations: ${this.pointsWithShortIterations}.`);
      this.pointsWithShortIterations = 0;

      console.log(`Amount of points in the Mandelbrot Set using the ${this.timesToIterate} iteration limit: ${this.pointsInSet}.`);
      this.pointsInSet = 0;
    }, 0);
  }

  // Numbers in the Mandelbrot Set are found through squaring and adding it's starting values.
  // This looks like z1 = a + bi, where z1 is some complex number, a is startReal, and b is startImaginary.
  // We then square z1 and add z1 to get z2 = z1^2 + c1. Then we do it again, which yields z3 = z2^2 + z1,
  // then z4 = z3^2 + z1, and so on. If the square of the magnitude of the complex number stays less than 4 (going
  // above this indicates the sequence of c's will explode to infinity) after this.timesToIterate, then that point is
  // in the Mandelbrot Set. If not, we return the amount of iterations it took before it was found to be divergent.
  vibeCheck(startReal: string, startImaginary: string, precedingPointsFound?: number): number {
    let complex: string[] = this.squareThenAdd("0", "0", startReal, startImaginary);
    let magnitudeSquared: string = this.math.bignumber(complex[0]).pow(2).plus(this.math.bignumber(complex[1])).pow(2).toString();
    let previousMagnitude: string = magnitudeSquared;
    let iterationCount: number = 1;
    precedingPointsFound = precedingPointsFound || 0;
    let endIterationAmount: number = 0.5 * (this.timesToIterate + (this.timesToIterate / (precedingPointsFound + 1)));

    while (iterationCount <= endIterationAmount) {
      complex = this.squareThenAdd(complex[0], complex[1], startReal, startImaginary);

      magnitudeSquared = this.math.bignumber(complex[0]).pow(2).plus(this.math.bignumber(complex[1])).pow(2).toString();

      // Often numbers reach a point in the loop where their magnitude is no longer changing.
      // This occurs due to precision being too low, but when it does occur, this kicks
      // us out to avoid looping any further, which saves some cost.
      if (previousMagnitude === magnitudeSquared) {
        this.skippedCount++;
        
        return this.timesToIterate;
      }

      previousMagnitude = magnitudeSquared;

      // If the sum of the squares of the real and imaginary components of a complex number are greater than 4
      // then that means that the number will fly off to infinity if it were iterated more, so it can't be the set.
      if (this.math.bignumber(magnitudeSquared).greaterThan(4)) {
        return iterationCount;
      }

      iterationCount++;
    }

    if (precedingPointsFound >= 1) {
      this.iterationsSkipped += this.timesToIterate - iterationCount;
    }

    return this.timesToIterate;
  }

  // Finds and checks nearby points to entered point. This is to run every time a valid point is find to see 
  // if the neighboring points are valid also. This works by finding a square of points around the xVal+yVali, 
  // then checking each, point there.
  // TODO: Take in a chunk of points, iterate through that to find borders, then loop through that, centering the new
  // findNeighbors call around the step above or below the current point. Checking the points to the left
  // and right probably is not necessary.
  findNeighbors(point: Point): Point[] {
    //console.log(`in findNeighbors with (${xVal.toString()}, ${yVal.toString()}) with tinyStep: ${tinyStep!.toString()}`);
    let points: Point[] = [];
    let xStart: BigNumber = this.math.bignumber(point.xcoord).minus(this.xStepDistance.div(2));
    let yStart: BigNumber = this.math.bignumber(point.ycoord).minus(this.yStepDistance.div(2));
    let xEnd: BigNumber = this.math.bignumber(point.xcoord).plus(this.xStepDistance.div(2));
    let yEnd: BigNumber = this.math.bignumber(point.ycoord).plus(this.yStepDistance.div(2));
    let xStep: BigNumber = this.xStepDistance.div(2).div(this.neighborsToCheck);
    let yStep: BigNumber = this.yStepDistance.div(2).div(this.neighborsToCheck);
    
    for (let nearXVal: BigNumber = xStart; this.isLessThanOrEqualTo(nearXVal, xEnd); nearXVal = nearXVal.plus(xStep)) {
      if (this.isLessThan(nearXVal, this.math.bignumber(this.xWindowLower))
     ||  !this.isLessThanOrEqualTo(nearXVal, this.math.bignumber(this.xWindowUpper))) {
        console.log("Skipping out-of-window point. Non-useful x-value.");
        console.log(`nearXVal: ${nearXVal.toString()}`);

        continue;
      }

      for (let nearYVal: BigNumber = yStart; this.isLessThanOrEqualTo(nearYVal, yEnd); nearYVal = nearYVal.plus(yStep)) {
        let iterationsPassed: number = this.vibeCheck(nearXVal.toString(), nearYVal.toString());
        
        if (this.isLessThan(nearYVal, this.math.bignumber(this.yWindowLower))
       ||  !this.isLessThanOrEqualTo(nearYVal, this.math.bignumber(this.yWindowUpper))) {
          console.log("Skipping out-of-window point. Non-useful y-value.");
          console.log(`nearYVal: ${nearYVal.toString()}`);

          continue;
        }

        // To avoid calculating the point and re-adding the same point we already found prior to the loop.
        if (this.isEqual(nearXVal, this.math.bignumber(point.xcoord)) && this.isEqual(nearYVal, this.math.bignumber(point.ycoord))) {
          continue;
        }

        points.push({xcoord: nearXVal.toString(), ycoord: nearYVal.toString(), zcoord: iterationsPassed.toString()});

        if (iterationsPassed === this.timesToIterate) {
          this.pointsInSet++;
        }
      }
    }

    this.neighboringPointsFound += points.length;

    return points;
  }

  // Squares and adds components of inputs and returns array with [new real component, new imaginary component].
  squareThenAdd(currentReal: string, currentImaginary: string, addReal: string, addImaginary: string): string[] {
    // This looks random, but is the result of combining like terms for 
    // the expression (currentReal+currentImaginary*i)^2+(addReal + addImaginary*i).
    return [this.math.bignumber(currentReal).pow(2).add(addReal).minus(this.math.bignumber(currentImaginary).pow(2)).toString(), 
      this.math.bignumber(currentReal).times(currentImaginary).times(2).plus(addImaginary).toString()];
  }

  // MathJS comparers like lessThan or equals are only accurate for numbers that are sufficiently large.
  // Because of that, these functions should act as a workaround for comparing two very small numbers.
  isEqual(leftNumber: BigNumber, rightNumber: BigNumber, overrideEpsilon?: BigNumber): boolean {
    if (leftNumber.toString() === rightNumber.toString()) {
      return true;
    }

    return this.isLessThan(this.math.abs(leftNumber.minus(rightNumber)), overrideEpsilon ?? this.math.bignumber(this.config.epsilon));
  }

  isLessThan(leftNumber: BigNumber, rightNumber: BigNumber): boolean {
    return this.math.isNegative(leftNumber.minus(rightNumber));
  }

  isLessThanOrEqualTo(leftNumber: BigNumber, rightNumber: BigNumber, overrideEpsilon?: BigNumber): boolean {
    if (this.isEqual(leftNumber, rightNumber, overrideEpsilon ?? this.math.bignumber(this.config.epsilon))) {
      return true;
    }

    return this.isLessThan(leftNumber, rightNumber);
  }

  getGraph(points: Point[]): void {
    PlotlyJS.extendTraces("plotlyChart", {
      x: [points.map(point => point.xcoord)], 
      y: [points.map(point => point.ycoord)],
      'marker.color': [points.map(point => point.zcoord)]
    }, [0]);
  }

  ngOnInit(): void {
  }
}

// Later TODO: Add a "more resolution" button that adds more points to the current set of points.
// This could look like taking the steps, finding the step distance, then halving that.
// With that, add it to the lowerWindow and minus it from the upper window.
// This would create the effect of nearly double the number of points.

// Probably not doing this one, 2nd passes doesn't do much and takes a long time.
// Doing it even more will give diminishing returns while taking even longer.
// Later TODO: Instead of doing a 2nd pass, allow for n number of passes. Instead of using a 
// bool to know if we should do another pass, have a pass number and keep decrementing it and
// calling the function again until it hits a certain point and that will be the final pass.

// Later TODO: Have functionality that removes points between two points if there exists no gaps
// between them. A gap would be any point along the set of stepped points that isn't in the points array,
// which is the set of all points that passed the vibeCheck() function.

// Later TODO: Add a function to test data after the graph is finished. This function would look for
// duplicate points. This is to ensure that the findNeighbors() function isn't adding in and calculating
// unnecessarily.

// Later TODO: Add a DB to save a graph to a table. When a button is cleared, retrieve those points and throw them
// onto the graph. Also have a button to delete those points from the DB. This would use code like the one from
// the Grapher program on my GitHub. In addition, this should also update the windowing variables here accordingly.
// Tables should be named according to their windowed-values and saving should be
// dis-allowed when current window-settings matches the naming scheme used in the DB. If naming the graphs in this way
// causes odd behaviors, try naming them in a master table and then naming the table the pkID found in the master table instead.

// Later TODO: In addition to above, it would be nice to query a master table in the DB with the name of all used
// tables for this set. If current windows matches any of those(hold them in an object array instead of constantly
// calling the DB) then query that table for all of its point-data.