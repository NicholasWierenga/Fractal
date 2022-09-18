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
    precision: 16,
    predictable: false,
    randomSeed: null
  };
  math: MathJsStatic = create(all, this.config);
  xSteps: number = 100;
  ySteps: number = 100;
  xWindowLower: string = "-2";
  xWindowUpper: string = ".5";
  yWindowLower: string = "-1.15";
  yWindowUpper: string = "1.15";
  secondPass: boolean = true; // Will be used in the future for a button on the front-end.
  xStepDistance!: BigNumber;
  yStepDistance!: BigNumber;
  timesToCalculate: number = 10;
  pointCount: number = 0;

  constructor() { } 
  
  findTrace(): void {
    let count: number = 0;
    let points: Point[] = [];

    this.createGraph();

    setTimeout(() => {
      this.xStepDistance = this.math.bignumber(this.xWindowUpper).minus(this.math.bignumber(this.xWindowLower)).div(this.xSteps);

      // TODO: Consider splitting this up into blocks then adding the trace. Right now, the graph slows down towards the end
      // quite a bit.
      for (let xVal: BigNumber = this.math.bignumber(this.xWindowLower); xVal.lessThanOrEqualTo(this.xWindowUpper); 
      xVal = xVal.plus(this.xStepDistance)) {
        points.push(...this.getNewPoints(xVal));
        count++;

        console.log(count);
        if (count % 10 == 0) {
          console.log("in the mod");
          this.sendPoints(points);

          points = [];
        }
      }

      if (count % 10 !== 0) {
        console.log("there's some points left");
        console.log(points);
        this.sendPoints(points);
      }

      console.log("Total points: " + this.pointCount);
    }, 10);
  }

  createGraph(): void {
    let layout: Partial<PlotlyJS.Layout> = {
      xaxis: {range: [this.xWindowLower, this.xWindowUpper]},
      yaxis: {range: [this.yWindowLower, this.yWindowUpper]},
      showlegend: false
    };

    PlotlyJS.newPlot("plotlyChart", [], layout);
  }

  // This function is to 
  sendPoints(points: Point[]): void {
      setTimeout(() => {
        this.pointCount += points.length;

        this.getGraph(points);
      }, 10);
  }

  getNewPoints(xVal: BigNumber): Point[] {
    let points: Point[] = [];
    this.yStepDistance = this.math.bignumber(this.yWindowUpper).minus(this.math.bignumber(this.yWindowLower)).div(this.ySteps);

      for (let yVal: BigNumber = this.math.bignumber(this.yWindowLower); yVal.lessThanOrEqualTo(this.yWindowUpper); 
      yVal = yVal.plus(this.yStepDistance)) {
        if (this.vibeCheck(xVal, yVal, this.timesToCalculate)) {
          points.push({xcoord: xVal.toString(), ycoord: yVal.toString(), zcoord: null});

          points.push(...this.findNeighbors(xVal, yVal, this.math.bignumber("2")));
        }
      }

    return points;
  }

  findNeighbors(xVal: BigNumber, yVal: BigNumber, neighborsToCheck: BigNumber): Point[] {
    let points: Point[] = [];

    // When a point is found, there's other points found nearby that are also in the set.
    // This loop looks through nearby points to see if they are also good.
    // TODO: It feels like x-values aren't working right and this is only generating new values with xVal and a different ycoord.
    for (let nearXVal: BigNumber = xVal.minus(this.xStepDistance); this.isLessThan(nearXVal, xVal.plus(this.xStepDistance)); 
    nearXVal = nearXVal.plus(this.xStepDistance.div(neighborsToCheck).times("2"))) {
      for (let nearYVal: BigNumber = yVal.minus(this.yStepDistance); this.isLessThan(nearYVal, yVal.plus(this.yStepDistance)); 
      nearYVal = nearYVal.plus(this.yStepDistance.div(neighborsToCheck).times("2"))) {
        // TODO: Try to avoid checking points near edges. Right now, points on the edges or near them cause points to be found
        // outside window range. Consider checking nearXVal and nearYVal so that they're in the windows.

        // To avoid calculating the point and re-adding the same point we already found prior to the loop.
        if (this.isEqual(nearXVal, xVal) && this.isEqual(nearYVal, yVal)) {
          //|| this.isLessThan(nearXVal.plus(xStepDistance.div(neighborsToCheck)), xVal.plus(xStepDistance)) 
          //|| this.isLessThan(nearYVal.plus(yStepDistance.div(neighborsToCheck)), xVal.plus(yStepDistance))
          continue;
        }

        if (this.vibeCheck(nearXVal, nearYVal)) {
          points.push({xcoord: nearXVal.toString(), ycoord: nearYVal.toString(), zcoord: null});
        }
      }
    }

    return points;
  }

  // Numbers in the mandelbrot set form patterns as the are squaredThenAdded to and trend toward a small 
  // set of numbers which that is rarely ever reached. Instead, these numbers 'vibrate' around the numbers
  // This function determines if there exists a trend for the number being looked at.
  vibeCheck(startReal: BigNumber, startImaginary: BigNumber, passNum?: number, seedReal?: BigNumber, seedImaginary?: BigNumber): boolean {
    let epsilon: BigNumber = this.math.bignumber(1 / this.timesToCalculate);
    let previousVals: string[] = [];
    let pointVal: string = "";
    let isIn: boolean = false;

    for (let count: number = 0; count < this.timesToCalculate; count++) {
      if (count == 0) {
        pointVal = this.squareThenAdd(`${seedReal || 0} + ${seedImaginary || 0}i`, `${startReal} + ${startImaginary}i`);
      }
      else {
        pointVal = this.squareThenAdd(pointVal, `${startReal.toString()} + ${startImaginary.toString()}i`);
      }

      previousVals.forEach(val => {
        if (this.isEqual(this.math.bignumber(val.split(" ")[0]), this.math.bignumber(pointVal.split(" ")[0]), epsilon)
        &&  this.isEqual(this.math.bignumber(val.split(" ")[2].replace("i", "")), 
                         this.math.bignumber(pointVal.split(" ")[2].replace("i", "")), epsilon)) {
         isIn = true;

         return;
        }
      });

      if (isIn) {
        // Doing a second pass allows the program to weed out points that were erroneously passed earlier. It also allows
        // for points that did not pass up to this point to not be checked further as they're likely not supposed to be in the
        // set, which saves a lot of the calculations.
        if (passNum == 1 && this.secondPass) {
          // TODO: Try getting this to fire only after previousVals is filled. It could be the case that we find a point
          // that happens to be quite close to a previous one and lead the point to be a false positive. It could also pose
          // issues because timesToCalculate is used to determine how strict comparisons must be to say there is a trend.
          return this.vibeCheck(this.math.bignumber(pointVal.split(" ")[0]), this.math.bignumber(pointVal.split(" ")[2]
          .replace("i", "")), 2, startReal, startImaginary);
        }
        else {
          return true;
        }
      }

      previousVals.push(pointVal);
    }

    return false;
  }

  // Using MathJS pow and add cause floating point errors when working with complex-type numbers, so we pass 
  // strings for complex numbers over here and do the math with them and then returns a precise complex number as a string.
  squareThenAdd(currentComplex: string, addComplex: string): string {
    let currentReal: string = currentComplex.split(" ")[0];
    let currentImaginary: string = "0";
    if (currentComplex.includes("i")) {
      currentImaginary = currentComplex.split(" ")[2].replace("i", "");
    }
    
    let addReal: string = addComplex.split(" ")[0];
    let addImaginary: string = "0";
    if (addComplex.includes("i")) {
      addImaginary = addComplex.split(" ")[2].replace("i", "");
    }

    // This looks random, but is the result of combining like terms for 
    // the expression (currentReal+currentImaginary*i)^2+(addReal + addImaginary*i).
    return `${this.math.bignumber(currentReal).pow(2).add(this.math.bignumber(addReal))
      .minus(this.math.bignumber(currentImaginary).pow(2))} + ${this.math.bignumber(currentReal)
      .times(this.math.bignumber(currentImaginary)).times("2").plus(this.math.bignumber(addImaginary))}i`;
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

  getGraph(points: Point[]): void {
    var trace: Partial<PlotlyJS.PlotData> = this.getTrace(points);

    PlotlyJS.addTraces("plotlyChart", trace);
  }

  getTrace(points: Point[]): Partial<PlotlyJS.PlotData> {
    var trace: Partial<PlotlyJS.PlotData> = {
      x: points.map(point => point.xcoord),
      y: points.map(point => point.ycoord),
      mode: 'markers',
      name: '',
      marker: {
        color: 'rgb(102,0,0)',
        size: 2,
        opacity: .6
      },
      type: 'scatter',
      hovertemplate: `(%{x}, %{y}i)`
    };

    return trace;
  }

  ngOnInit(): void {
  }
}

// Later TODO: Add a "more resolution" button that adds more points to the current set of points.
// This could look like taking the steps, finding the step distance, then halving that.
// With that, add it to the lowerWindow and minus it from the upper window.
// This would create the effect of nearly double the number of points.

// Later TODO: Instead of doing a 2nd pass, allow for n number of passes. Instead of using a 
// bool to know if we should do another pass, have a pass number and keep decrementing it and
// calling the function again until it hits a certain point and that will be the final pass.

// Later TODO: Have functionality that removes points between two points if there exists no gaps
// between them. A gap would be any point along the set of stepped points that isn't in the points array,
// which is the set of all points that passed the vibeCheck() function.