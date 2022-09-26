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
  xWindowLower: string = "-2";
  xWindowUpper: string = ".5";
  yWindowLower: string = "-1.15";
  yWindowUpper: string = "1.15";
  secondPass: boolean = false; // Will be used in the future for a button on the front-end.
  xStepDistance!: BigNumber;
  yStepDistance!: BigNumber;
  pointCount: number = 0;
  plotlyChart: any;
  // Below act as controls for the resolution of the graph. x/ySteps affects the amount of points 
  // tested on the graph. neighborsToCheck is the amount of points near to any good point found
  // that will also be checked. timesToIterate is the maximum amount of times a point is iterated
  // to determine if it is in the set or not. Upping the value of any of these improves resolution,
  // but at the cost of performance.
  xSteps: number = 20;
  ySteps: number = 20;
  neighborsToCheck: number = 1;
  timesToIterate: number = 150;

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
        color: 'rgb(102,0,0)',
        size: 1,
        opacity: .5
      },
      type: 'scatter',
      // TODO: Points graphed on a complex plane should shown as x + yi instead of (x, y). Find some way to do that that won't show up
      // as something like 4 + -3i. 
      hovertemplate: `%{x}+%{y}i`
    };

    return trace;
  }
  
  findTrace(): void {
    this.pointCount = 0;
    let count: number = 0;
    let points: Point[] = [];
    this.xStepDistance = this.math.bignumber(this.xWindowUpper).minus(this.math.bignumber(this.xWindowLower)).div(this.xSteps);

    console.time('time to graph');

    // The setTimeouts are to give plotlyJS time to update the graph.
    for (let xVal: BigNumber = this.math.bignumber(this.xWindowLower); this.isLessThanOrEqualTo(xVal, this.math.bignumber(this.xWindowUpper)); 
    xVal = xVal.plus(this.xStepDistance)) {
      setTimeout(() => {
        points.push(...this.getNewPoints(xVal));
        count++;
        
        if (count % 4 === 0 || this.isEqual(xVal, this.math.bignumber(this.xWindowUpper))) {
          this.pointCount += points.length;
          this.getGraph(points);

          points = [];

          console.log("Total points: " + this.pointCount);
        }
      }, 0)
    }
    
    setTimeout(() => {
      console.timeEnd('time to graph');
    }, 0);
  }

  // TODO: We want to color points according to how many iterations it took to find them, so maybe put that in as a z-value?
  getNewPoints(xVal: BigNumber): Point[] {
    let points: Point[] = [];
    let lastYVal: BigNumber| undefined;
    this.yStepDistance = this.math.bignumber(this.yWindowUpper).minus(this.math.bignumber(this.yWindowLower)).div(this.ySteps);

    for (let yVal: BigNumber = this.math.bignumber(this.yWindowLower); yVal.lessThanOrEqualTo(this.yWindowUpper); 
    yVal = yVal.plus(this.yStepDistance)) {
      if (this.vibeCheck(xVal, yVal)) {
        points.push({xcoord: xVal.toString(), ycoord: yVal.toString(), zcoord: null});

        if (this.neighborsToCheck > 0) {
          points.push(...this.findNeighbors(xVal, yVal, false));
        }

        lastYVal = yVal;
      }
      //else if (lastYVal! !== undefined) {
      //  if (this.neighborsToCheck > 0) {
      //    points.push(...this.findNeighbors(xVal, lastYVal, false));
      //  }
//
      //  lastYVal = undefined;
      //}
    }

    return points;
  }

  // TODO: This function only finds border points with a gap in y-values. In the future, x-value gaps will
  // also be returned.
  //findBorderPoints(points: Point[]): Point[] {
  //  let gapX: boolean = false;
  //  let gapY: boolean = false;
  //  let borderPoints: Point[] = [];
  //  let xPoints: Point[] = [];
  //  let yPoints: Point[] = [];
  //  let pointIndex: number = -1;
  //  let previousPoint: Point | undefined;
//
  //  // categorize points into xVals broken up into each small xValStep, then look up and down it. If there is no higher point,
  //  // then that is a border points. If there is no lower point, then that is a border point. If there is a higher and lower point
  //  // in the gap, then that is not a border point and should be skipped.
  //  for (let nearXVal: BigNumber = this.math.bignumber(this.xWindowLower); 
  //  this.isLessThanOrEqualTo(nearXVal, this.math.bignumber(this.xWindowUpper)); 
  //  nearXVal = nearXVal.plus(this.xStepDistance.div(this.neighborsToCheck * 2))) {
  //    let lowestY: BigNumber;
  //    let highestY: BigNumber;
  //    previousPoint = undefined;
  //    gapY = false;
//
  //    xPoints = points.filter((point) => point.xcoord === nearXVal.toString());
//
  //    xPoints.forEach((point, index) => {
  //      if (lowestY === undefined || this.isLessThan(this.math.bignumber(point.ycoord), lowestY)) {
  //        lowestY = this.math.bignumber(point.ycoord);
  //      }
//
  //      if (highestY === undefined || !this.isLessThanOrEqualTo(this.math.bignumber(point.ycoord), highestY)) {
  //        highestY = this.math.bignumber(point.ycoord);
  //      }
//
  //      if (index === xPoints.length - 1) {
  //        if (lowestY.toString() === highestY.toString()) {
  //          borderPoints.push({xcoord: nearXVal.toString(), ycoord: lowestY.toString(), zcoord: null});
  //        }
  //        else {
  //          borderPoints.push({xcoord: nearXVal.toString(), ycoord: lowestY.toString(), zcoord: null});
  //          borderPoints.push({xcoord: nearXVal.toString(), ycoord: highestY.toString(), zcoord: null});
  //        }
  //      }
  //    });
//
  //    for (let nearYVal: BigNumber = this.math.bignumber(this.yWindowLower); 
  //    this.isLessThanOrEqualTo(nearYVal, this.math.bignumber(this.yWindowUpper)); 
  //    nearYVal = nearYVal.plus(this.yStepDistance.div(this.neighborsToCheck * 2))) {
  //      let pointIndex: number = xPoints.findIndex((point) => point.ycoord === nearYVal.toString());
//
  //      if ((lowestY! !== undefined && nearYVal.toString() === lowestY!.toString()) 
  //      || (highestY! !== undefined && nearYVal.toString() === highestY!.toString())) {
  //        gapY = false;
//
  //        previousPoint = undefined;
  //        
  //        continue;
  //      }
//
  //      if (pointIndex === -1) { // point does not exist
  //        if (previousPoint !== undefined) {
  //          borderPoints.push(previousPoint);
  //        
  //          previousPoint = undefined;
  //        }
//
  //        gapY = true;
  //      }
  //      else { // point does exist
  //        if (gapY) {
  //          borderPoints.push(xPoints[pointIndex]);
  //        }
//
  //        gapY = false;
  //        
  //        previousPoint = xPoints[pointIndex];
  //      }
  //    }
  //  }
//
  //  return borderPoints;
  //}

  // Finds and checks nearby points to entered point. This is to run every time a valid point is find to see if the
  // neighboring points are valid also. This works by finding a square of points around the xVal+yVali, then checking each,
  // point there.
  findNeighbors(xVal: BigNumber, yVal: BigNumber, tinyStep?: boolean): Point[] {
    //console.log(`in findNeighbors with (${xVal.toString()}, ${yVal.toString()}) with tinyStep: ${tinyStep!.toString()}`);
    let points: Point[] = [];
    let xSteps: BigNumber = this.xStepDistance.div((this.neighborsToCheck + 1) * 2);
    let ySteps: BigNumber = this.yStepDistance.div((this.neighborsToCheck + 1) * 2);
    if (tinyStep) {
      xSteps = xSteps.div(3);
      ySteps = ySteps.div(3);
    }
    
    for (let nearXVal: BigNumber = xVal.minus(this.xStepDistance.div(2)).plus(xSteps); 
    this.isLessThanOrEqualTo(nearXVal, xVal.plus(this.xStepDistance).minus(this.xStepDistance.div(2))); 
    nearXVal = nearXVal.plus(xSteps)) {
      for (let nearYVal: BigNumber = yVal.minus(this.yStepDistance.div(2)).plus(ySteps); 
      this.isLessThanOrEqualTo(nearYVal, yVal.plus(this.yStepDistance).minus(this.yStepDistance.div(2))); 
      nearYVal = nearYVal.plus(ySteps)) {

        if (!tinyStep && nearYVal.toString() === yVal.minus(this.yStepDistance.div(2)).plus(ySteps).toString()
        &&  !this.vibeCheck(nearXVal, nearYVal.minus(ySteps))) {
          points.push(...this.findNeighbors(nearXVal, nearYVal, true));
        } 
        else if (!tinyStep && nearYVal.toString() === yVal.plus(this.yStepDistance).minus(this.yStepDistance.div(2)).toString()
        &&  !this.vibeCheck(nearXVal, nearYVal.plus(ySteps))) {
          points.push(...this.findNeighbors(nearXVal, nearYVal, true));
        } 
        else if (!tinyStep && nearXVal.toString() === xVal.minus(this.xStepDistance.div(2)).plus(xSteps).toString()
        &&  !this.vibeCheck(nearXVal.minus(xSteps), nearYVal)) {
          points.push(...this.findNeighbors(nearXVal, nearYVal, true));
        }
        else if (!tinyStep && nearXVal.toString() === xVal.plus(this.xStepDistance).minus(this.xStepDistance.div(2)).toString()
        &&  !this.vibeCheck(nearXVal.plus(xSteps), nearYVal)) {
          points.push(...this.findNeighbors(nearXVal, nearYVal, true));
        }
        // TODO: Try to avoid checking points near edges. Right now, points on the edges or near them cause points to be found
        // outside window range. Consider checking nearXVal and nearYVal so that they're in the windows.
        // To avoid calculating the point and re-adding the same point we already found prior to the loop.
        if (this.isEqual(nearXVal, xVal) && this.isEqual(nearYVal, yVal)) {
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
    const windowArea: BigNumber = this.math.bignumber(this.xWindowUpper).minus(this.xWindowLower).times(
      this.math.bignumber(this.yWindowUpper).minus(this.yWindowLower));
    // TODO: The program doesn't handle zooming in quite right. The fractal should go on forever, but because this.timesToCalculate
    // is set to some constant, it probably acts as a limiter. Maybe use windowArea to calculate timesToCalculate?
    const epsilon: BigNumber = windowArea.div(this.math.bignumber(this.timesToIterate).mul(1));
    let previousVals: string[] = [];
    let pointVal: string = "";
    let isIn: boolean = false;

    for (let count: number = 0; count < this.timesToIterate; count++) {
      if (count == 0) {
        pointVal = this.squareThenAdd(`${seedReal || "0"} + ${seedImaginary || "0"}i`, `${startReal} + ${startImaginary}i`);
      }
      else {
        pointVal = this.squareThenAdd(pointVal, `${startReal} + ${startImaginary}i`);
      }

      // Numbers not in the set usually fly off to infinity.
      if (pointVal.includes("NaN") || pointVal.includes("Infinity")) {
        return false;
      }

      // Trends in numbers can take quite a few iterations before being found, so to avoid searching the array
      // for an equalish number it is only checked every so often.
      if (!isIn && count % 10 === 0) {
        for (let val of previousVals) {
          if (this.isEqual(this.math.bignumber(val.split(" ")[0]), this.math.bignumber(pointVal.split(" ")[0]), epsilon)
          &&  this.isEqual(this.math.bignumber(val.split(" ")[2].replace("i", "")), 
                           this.math.bignumber(pointVal.split(" ")[2].replace("i", "")), epsilon)) {
            isIn = true;
  
            break;
          }
        }
      }

      // If a valid point is found, we continue the iterations to get a good pointVal, but we don't need to add it into
      // this array, as we're never looking at it again after a good point is found.
      if (!isIn) {
        previousVals.push(pointVal);
      }
    }

    if (isIn) {
      // Doing a second pass allows the program to weed out points that were erroneously passed earlier. It also allows
      // for points that did not pass up to this point to not be checked further as they're likely not supposed to be in the
      // set, which saves a lot of the calculations.
      if (passNum == 1 && this.secondPass) {
        return this.vibeCheck(this.math.bignumber(pointVal.split(" ")[0]), this.math.bignumber(pointVal.split(" ")[2]
        .replace("i", "")), 2, startReal, startImaginary);
      }
      else {
        return true;
      }
    }
    else {
      return false;
    }
  }

  // Using MathJS pow and add cause floating point errors when working with complex-type numbers, so we pass 
  // strings for complex numbers over here and do the math with them and then returns a precise complex number as a string.
  squareThenAdd(currentComplex: string, addComplex: string): string {
    let currentReal: string = currentComplex.split(" ")[0];
    let currentImaginary: string = currentComplex.split(" ")[2].replace("i", "");
    let addReal: string = addComplex.split(" ")[0];
    let addImaginary: string = addComplex.split(" ")[2].replace("i", "");

    // This looks random, but is the result of combining like terms for 
    // the expression (currentReal+currentImaginary*i)^2+(addReal + addImaginary*i).
    return `${this.math.bignumber(currentReal).pow("2").add(this.math.bignumber(addReal))
      .minus(this.math.bignumber(currentImaginary).pow("2"))} + ${this.math.bignumber(currentReal)
      .times(this.math.bignumber(currentImaginary)).times("2").plus(this.math.bignumber(addImaginary))}i`;
  }

  // This currently is never called, but might be in the future, so it will be left in.
  // Returns true if both complex numbers are somewhat near each other. False if they are not.
  //checkComplexDifference(firstComplex: string, secondComplex: string): boolean {
  //  let firstReal: string = firstComplex.split(" ")[0];
  //  let firstImaginary: string = firstComplex.split(" ")[2].replace("i", "");
  //  let secondReal: string = secondComplex.split(" ")[0];
  //  let secondImaginary: string = secondComplex.split(" ")[2].replace("i", "");
//
  //  let firstMagnitude: BigNumber = this.math.sqrt(this.math.bignumber(firstReal).pow(2)
  //  .plus(this.math.bignumber(firstImaginary).pow(2)));
  //  let secondMagnitude: BigNumber = this.math.sqrt(this.math.bignumber(secondReal)
  //  .pow(2).plus(this.math.bignumber(secondImaginary).pow(2)));
//
  //  if (this.isLessThanOrEqualTo(secondMagnitude, firstMagnitude.times(4))) {
  //    return true;
  //  }
  //  else {
  //    return false;
  //  }
  //}

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
    PlotlyJS.extendTraces("plotlyChart", {x: [points.map(point => point.xcoord)], y: [points.map(point => point.ycoord)]}, [0]);
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

// Later TODO: Add a function to test data after the graph is finished. This function would look for
// duplicate points. This is to ensure that the findNeighbors() function isn't adding in and calculating
// unnecessarily.

// Later TODO: Color each point according to the amount of steps it needed to be retried before a pattern was found.

// Later TODO: Calculate everything, but for each iteration, add those points and color them whatever. Then add in the
// next extendTrace the newly found points, and so on an so forth. This would show the user an image that is slowly
// getting more and more defined, and could let us have some button to click and check the next iteration.