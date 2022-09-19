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
  xSteps: number = 50;
  ySteps: number = 50;
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

  createGraph(): void {
    console.log("in creategraph");
    this.pointCount = 0;
    let layout: Partial<PlotlyJS.Layout> = {
      xaxis: {range: [this.xWindowLower, this.xWindowUpper]},
      yaxis: {range: [this.yWindowLower, this.yWindowUpper]},
      showlegend: false,
      //dragmode: false,
      //clickmode: "none",
      //autosize: false,
      //hovermode: false
    };

    console.log(layout.xaxis);
    console.log(layout.yaxis);

    PlotlyJS.newPlot("plotlyChart", [this.getTrace([])], layout).then( () => {
      this.messWithGraph();

      this.findTrace();
    });
  }

  messWithGraph(): void {
    var plotlyChart: any = document.getElementById('plotlyChart'); // as PlotlyJS.PlotlyHTMLElement
    let xWindowString: string = "";
    let yWindowString: string = "";
    let isMousedown: boolean = false;
    
    var xaxis = plotlyChart._fullLayout.xaxis;
    var yaxis = plotlyChart._fullLayout.yaxis;
    var l = plotlyChart._fullLayout.margin.l;
    var t = plotlyChart._fullLayout.margin.t;  


    //plotlyChart.on('plotly_click', (data: { points: string | any[]; }) => {
    //  var pts = '';
    //
    //  for (var i = 0; i < data.points.length; i++) {
    //    pts = 'x = ' + data.points[i].x + '\ny = ' +
    //      data.points[i].y!.toString() + '\n\n';
    //  }
    //
    //  alert('Closest point clicked:\n\n' + pts);
    //});
    
    //plotlyChart.on('plotly_click', function(data: any) {

      plotlyChart.addEventListener('mousedown', (evt: any) => {
        console.log("in mousedown")
        isMousedown = true;
        this.xWindowLower = xaxis.p2c(evt.x - l).toString();
        this.yWindowLower = yaxis.p2c(evt.y - t).toString();
        
        //PlotlyJS.relayout(plotlyChart, {'title': ['x: ' + xInDataCoord, 'y : ' + yInDataCoord].join('<br>')});
    
      });
      
      //plotlyChart.addEventListener('mouseup', (evt: any) => {
      //  console.log("in mouseup event");
      //  isMousedown = false;
      //  this.xWindowUpper = xaxis.p2c(evt.x - l).toString();
      //  this.yWindowUpper = yaxis.p2c(evt.y - t).toString();
      //});

        plotlyChart.addEventListener('mouseover', (evt: any) => {
          if (isMousedown) {
            console.log("in mouseover event");
            isMousedown = false;
            this.xWindowUpper = xaxis.p2c(evt.x - l).toString();
            this.yWindowUpper = yaxis.p2c(evt.y - t).toString();

            //PlotlyJS.purge('plotlyChart');
        
            this.createGraph();
          }
        });

    //});
  }
  
  findTrace(): void {
    let count: number = 0;
    let points: Point[] = [];
    this.xStepDistance = this.math.bignumber(this.xWindowUpper).minus(this.math.bignumber(this.xWindowLower)).div(this.xSteps);

    // The setTimeouts are to get plotlyJS time to create and update the graph.
    //setTimeout(() => {

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
    //});
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

  isLessThanOrEqualTo(leftNumber: BigNumber, rightNumber: BigNumber): boolean {
    if (this.isEqual(leftNumber, rightNumber)) {
      return true;
    }

    return this.isLessThan(leftNumber, rightNumber);
  }

  getGraph(points: Point[]): void {
    PlotlyJS.extendTraces("plotlyChart", {x: [points.map(point => point.xcoord)], y: [points.map(point => point.ycoord)]}, [0]);
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