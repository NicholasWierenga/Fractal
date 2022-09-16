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
    epsilon: 1e-32,
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
  yWindowLower: string = "-2";
  yWindowUpper: string = "2";
  secondPass: boolean = true; // Will be used in the future for a button on the front-end.

  constructor() { } 
  
  findTrace(): void {
    let timesToCalculate: number = 10;

    let points: Point[] = this.getNewPoints(timesToCalculate);

    console.log("Points found: " + points.length);

    this.getGraph(points);
  }

  getNewPoints(timesToCalculate: number): Point[] {
    let points: Point[] = [];
    let xStepDistance = this.math.bignumber(this.xWindowUpper).minus(this.math.bignumber(this.xWindowLower)).div(this.xSteps);
    let yStepDistance = this.math.bignumber(this.yWindowUpper).minus(this.math.bignumber(this.yWindowLower)).div(this.ySteps);
    let neighborsToCheck = this.math.bignumber("3");
    let count: number = 0;

    for (let xVal: BigNumber = this.math.bignumber(this.xWindowLower); xVal.lessThanOrEqualTo(this.xWindowUpper); 
    xVal = xVal.plus(xStepDistance)) {
      for (let yVal: BigNumber = this.math.bignumber(this.yWindowLower); yVal.lessThanOrEqualTo(this.yWindowUpper); 
      yVal = yVal.plus(yStepDistance)) {
        if (this.vibeCheck(xVal, yVal, timesToCalculate)) {
          points.push({xcoord: xVal.toString(), ycoord: yVal.toString(), zcoord: null});
          count++;

          // When a point is found, there's other points found nearby that are also in the set.
          // This loop looks through nearby points to see if they are also good.
          for (let nearXVal: BigNumber = xVal.minus(xStepDistance); 
          this.isLessThan(nearXVal, xVal.plus(xStepDistance)); nearXVal = nearXVal.plus(xStepDistance.div(neighborsToCheck).times("2"))) {
            for (let nearYVal: BigNumber = yVal.minus(yStepDistance); 
            this.isLessThan(nearYVal, yVal.plus(yStepDistance)); nearYVal = nearYVal.plus(yStepDistance.div(neighborsToCheck).times("2"))) {
              //console.log("nearXVal: " + nearXVal.toString());
              //console.log("nearYVal: " + nearYVal.toString());

              // TODO: Try to avoid checking points near edges. Right now, points on the edges or near them cause points to be found
              // outside window range. Consider checking nearXVal and nearYVal so that they're in the windows.

              // To avoid calculating the point and re-adding the same point we already found prior to the loop.
              if (nearXVal != xVal && nearYVal != yVal) {
                //|| this.isLessThan(nearXVal.plus(xStepDistance.div(neighborsToCheck)), xVal.plus(xStepDistance)) 
                //|| this.isLessThan(nearYVal.plus(yStepDistance.div(neighborsToCheck)), xVal.plus(yStepDistance))
                continue;
              }

              if (this.vibeCheck(nearXVal, nearYVal, timesToCalculate)) {
                count++;

                if (count % 1000) {
                  console.log("found a thousand more points");
                }

                points.push({xcoord: nearXVal.toString(), ycoord: nearYVal.toString(), zcoord: null});
              }
            }
          }
        }
      }
    }

    return points;
  }

  // Numbers in the mandelbrot set form patterns as the are squaredThenAdded to and trend toward a small 
  // set of numbers which that is rarely ever reached. Instead, these numbers 'vibrate' around the numbers
  // This function determines if there exists a trend for the number being looked at.
  vibeCheck(startReal: BigNumber, startImaginary: BigNumber, timesToCalculate: number, 
  passNum?: number, seedReal?: BigNumber, seedImaginary?: BigNumber): boolean {
    let epsilon: BigNumber = this.math.bignumber(1 / timesToCalculate);
    let previousVals: string[] = [];
    let pointVal: string = "";
    let isIn: boolean = false;

    for (let count: number = 0; count < timesToCalculate; count++) {
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
          .replace("i", "")), timesToCalculate, 2, startReal, startImaginary);
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
  isEqual(leftNumber: BigNumber, rightNumber: BigNumber, epsilon: BigNumber): boolean {
    if (leftNumber.toString() === rightNumber.toString()) {
      return true;
    }

    return this.isLessThan(this.math.abs(leftNumber.minus(rightNumber)), epsilon);
  }

  isLessThan(leftNumber: BigNumber, rightNumber: BigNumber): boolean {
    return this.math.isNegative(leftNumber.minus(rightNumber));
  }

  getGraph(points: Point[]): void {
    let layout: Partial<PlotlyJS.Layout> = {
      xaxis: {range: [this.xWindowLower, this.xWindowUpper]},
      //yaxis: {range: [this.yWindowLower, this.yWindowUpper]}
    };

    var trace: Partial<PlotlyJS.PlotData> = this.getTrace(points);
    
    PlotlyJS.newPlot("plotlyChart", [trace], layout);
  }

  getTrace(points: Point[]): any {
    var trace = {
      x: points.map(point => point.xcoord),
      y: points.map(point => point.ycoord),
      mode: 'markers',
      name: '',
      marker: {
        color: 'rgb(102,0,0)',
        size: 3,
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