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
  xSteps: number = 30;
  ySteps: number = 30;
  xWindowLower: string = "-2";
  xWindowUpper: string = ".5";
  yWindowLower: string = "-1.15";
  yWindowUpper: string = "1.15";
  secondPass: boolean = false; // Will be used in the future for a button on the front-end.
  xStepDistance!: BigNumber;
  yStepDistance!: BigNumber;
  timesToCalculate: number = 100;
  pointCount: number = 0;
  plotlyChart: any;

  constructor() { } 

  createGraph(): void {
    let layout: Partial<PlotlyJS.Layout> = {
      xaxis: {range: [this.xWindowLower, this.xWindowUpper]},
      yaxis: {range: [this.yWindowLower, this.yWindowUpper]},
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
        size: 2,
        opacity: .6
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
        
        if (count % 10 === 0 || this.isEqual(xVal, this.math.bignumber(this.xWindowUpper))) {
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
    this.yStepDistance = this.math.bignumber(this.yWindowUpper).minus(this.math.bignumber(this.yWindowLower)).div(this.ySteps);

      for (let yVal: BigNumber = this.math.bignumber(this.yWindowLower); yVal.lessThanOrEqualTo(this.yWindowUpper); 
      yVal = yVal.plus(this.yStepDistance)) {
        if (this.vibeCheck(xVal, yVal, this.timesToCalculate)) {
          points.push({xcoord: xVal.toString(), ycoord: yVal.toString(), zcoord: null});

          // Upping the bignumber below makes the graph slower and increases resolution.
          points.push(...this.findNeighbors(xVal, yVal, this.math.bignumber("5")));
        }
      }

    return points;
  }

  // Finds and checks nearby points to entered point. This is to run every time a valid point is find to see if the
  // neighboring points are valid also.
  findNeighbors(xVal: BigNumber, yVal: BigNumber, neighborsToCheck: BigNumber): Point[] {
    let points: Point[] = [];

    // When a point is found, there's other points found nearby that are also in the set.
    // This loop looks through nearby points to see if they are also good.
    for (let nearXVal: BigNumber = xVal.minus(this.xStepDistance); this.isLessThan(nearXVal, xVal.plus(this.xStepDistance)); 
    nearXVal = nearXVal.plus(this.xStepDistance.div(neighborsToCheck))) {
      for (let nearYVal: BigNumber = yVal.minus(this.yStepDistance); this.isLessThan(nearYVal, yVal.plus(this.yStepDistance)); 
      nearYVal = nearYVal.plus(this.yStepDistance.div(neighborsToCheck))) {
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
    const windowArea: BigNumber = this.math.bignumber(this.xWindowUpper).minus(this.xWindowLower).times(
      this.math.bignumber(this.yWindowUpper).minus(this.yWindowLower));

    //let epsilon: BigNumber = this.math.bignumber(1 / this.timesToCalculate);
    // TODO: Think up a better way to get epsilon here. This feels weird and dividing by anything but 1 slows down the program.
    const epsilon: BigNumber = windowArea.div(this.math.bignumber(this.timesToCalculate).mul(4));
    //let epsilon: BigNumber = this.math.bignumber(".01");
    let previousVals: string[] = [];
    let pointVal: string = "";
    let isIn: boolean = false;

    for (let count: number = 0; count < this.timesToCalculate; count++) {
      if (count == 0) {
        pointVal = this.squareThenAdd(`${seedReal || 0} + ${seedImaginary || 0}i`, `${startReal} + ${startImaginary}i`);
      }
      else {
        pointVal = this.squareThenAdd(pointVal, `${startReal.toString()} + ${startImaginary.toString()}i`);

        // Every so many iterations, we check to see if the point is flying off to infinity. If it is, it's not in the
        // set and so we don't bother calculating any further. This saves a fair bit of time.
        if (count % 3 === 0 && !this.checkComplexDifference(`${startReal} + ${startImaginary}i`, pointVal)) {
          return false;
        }
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

  // Returns true if both complex numbers are somewhat near each other. False if they are not.
  checkComplexDifference(firstComplex: string, secondComplex: string): boolean {
    let firstReal: string = firstComplex.split(" ")[0];
    let firstImaginary: string = "0";
    if (firstComplex.includes("i")) {
      firstImaginary = firstComplex.split(" ")[2].replace("i", "");
    }
    
    let secondReal: string = secondComplex.split(" ")[0];
    let secondImaginary: string = "0";
    if (secondComplex.includes("i")) {
      secondImaginary = secondComplex.split(" ")[2].replace("i", "");
    }

    let firstMagnitude: BigNumber = this.math.sqrt(this.math.bignumber(firstReal).pow(2).plus(this.math.bignumber(firstImaginary).pow(2)));
    let secondMagnitude: BigNumber = this.math.sqrt(this.math.bignumber(secondReal).pow(2).plus(this.math.bignumber(secondImaginary).pow(2)));

    if (this.isLessThanOrEqualTo(secondMagnitude, firstMagnitude.times(3))) {
      return true;
    }
    else {
      return false;
    }
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