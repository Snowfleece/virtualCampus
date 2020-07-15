import { withStyles } from "@material-ui/core/styles";
import moment from "moment";
import React from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "../components/events/react-big-calendar.css";
import { EventCard, EventModal, Template, CustomButton, Title, Search } from "../components";
import firebase from "../firebase";
import { Link, Element, animateScroll as scroll, scrollSpy, scroller } from 'react-scroll'
// import ScrollableAnchor from 'react-scrollable-anchor';
// import {goToAnchor, configureAnchors} from 'react-scrollable-anchor';
import queryString from 'query-string';
import Fuse from 'fuse.js';
import {getTimezoneName, convertUTCToLocal, convertDateToUTC,
  getOffset, getCurrentLocationForTimeZone, dst, convertTimestampToDate}
  from "../components/all/TimeFunctions"
import CustomToolbar from "../components/events/CalendarToolBar";
// configureAnchors({offset: -100});

const localizer = momentLocalizer(moment);
const useStyles = () => ({
  addNewButton: {
    boxShadow: "none",
    fontSize: 20
  }

});

class Events extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
      event: null,
      count: 0,
      myEventsList: [],
      permEventsList: [],
      displayEvents: [],
      eventSearch: [],
      eventSearchError: '',
      searchVal: "",
      defaultSearchInput:''
    };
    this.closeDo = this.closeDo.bind(this);
  }

  convertEventsTime(event) {
    const tzString = event.timezone;

    event.start_date = event.start_date.split("GMT")[0];
    event.end_date = event.end_date.split("GMT")[0];

    if (event.timezone !== undefined && event.timezone.includes("$")) {
      // $ splits time and timezone in the event.timezone field in firebase!
      const tz = tzString.split("$")[0];
      const daylightSavings = tzString.split("$")[1] === "true" ? true : false;
      const offset = getOffset(tz, daylightSavings);

      // First convert the event's time to UTC, assuming the event is in EST time (America/New_York)
      // America/New_York should be changed to the user's time zone who created the event, if they
      // Choose to use their time zone rather than EST.
      const UTCStart = convertDateToUTC(convertTimestampToDate(event.start_date), offset);
      const UTCEnd = convertDateToUTC(convertTimestampToDate(event.end_date), offset);

      // Second, convert those consts above to user's local time
      event.start_date = convertUTCToLocal(UTCStart);
      event.end_date = convertUTCToLocal(UTCEnd);
      // get timezone to display
      event.timeZoneGMT = getTimezoneName(getCurrentLocationForTimeZone(), dst());
    }
    return event;
  }

  async componentDidMount() {
    await this.getEvents();
    let query = queryString.parse(this.props.location.search);
    let {event} = query;
    // goToAnchor(event, true);
    if (event){
        console.log(event);
        scroller.scrollTo(event, {
          // duration: 1500,
          // delay: 100,
          smooth: true,
          // containerId: 'ContainerElementID',
          offset: -100, // Scrolls to element + 50 pixels down the page
        })
    }
  }

  // TODO(claire): These are the new functions to use the Google Calendar API instead.
  // TODO (claire): The new event attributes: https://developers.google.com/calendar/v3/reference/events#resource
  // makeDisplayEvents(events) {
  //   let arr = [];
  //   for (let i = 0; i < events.length; i += 1) {
  //     let ele = events[i];
  //     if (ele.end > new Date().toISOString()) {
  //       arr.push(ele);
  //     }
  //     if (arr.length === 5) {
  //       break;
  //     }
  //   }
  //   return arr;
  // }

  // async getEvents() {
  //   getCalendarEvents((events) => {
  //     this.setState({ myEventsList: events, displayEvents: this.makeDisplayEvents(events) });
  //   })
  // }

  makeDisplayEvents(events) {
    let approvedEventsMap = {};
    Object.keys(events).map((k, ind) => {
      let ele = events[k];
      if (ele.end_date > new Date()) {
        approvedEventsMap[k] = ele;
      }
    });
    return approvedEventsMap;
  }


  async getEvents() {
    let db = firebase.firestore();
    let approvedEvents = await db.collection("events")
      .where("approved", "==", true)
      .orderBy("start_date", 'asc')
      .get();
    let approvedEventsMap = {};
    if(approvedEvents){
      approvedEvents.docs.map(doc => approvedEventsMap[doc.id]=this.convertEventsTime(doc.data()));
      // approvedEventsMap = approvedEvents.docs.map(doc => this.convertEventsTime(doc.data()));
    }
    this.setState({ myEventsList: Object.values(approvedEventsMap), permEventsList: Object.values(approvedEventsMap),
                         displayEvents:this.makeDisplayEvents(approvedEventsMap) });
  }

  searchFunc(val, changeDefaultSearchVal=true) {
    if(changeDefaultSearchVal){
      this.setState({defaultSearchInput:''});
    }
    if(!val || val.length===0) {
      return this.setState({eventSearch: [], activityIndicator: false, eventSearchError: '',
                                 myEventsList: this.state.permEventsList});
    }
    this.setState({activityIndicator:true});
    const options = {
      threshold:0.2,
      distance:1000,
      keys: ['tags', 'name', "event"]
    };
    const fuse = new Fuse(this.state.permEventsList, options);
    const output = fuse.search(val);
    const eventSearch = output;

    if(!eventSearch || eventSearch.length<=0){
      return this.setState({eventSearch:[], activityIndicator:false, eventSearchError:'No Results found',
                                myEventsList: []});
    }
    let itemOn = 0
    const approvedEventsMap = eventSearch.map(doc => (eventSearch[itemOn++]['item']));

    // Update events. Note: we don't have to update time again b/c time is already updated
    this.setState({eventSearch:eventSearch, activityIndicator:false, eventSearchError:'',
                         myEventsList: approvedEventsMap});
  }

  formatTime(hours, min) {
    let h = hours > 12 ? hours - 12 : hours;
    let m = min < 10 ? "0" + min.toString() : min.toString();
    let add = hours > 12 ? "PM" : "AM";
    return h + ":" + m + add;
  }

  attendEvent(ele) {
    this.setState({ open: true, event: ele });
  }

  closeDo() {
    this.setState({ open: false, count: 0 });
  }

  eventPropStyles(event, start, end, isSelected) {
    let style = {
      backgroundColor: "#2984ce"
    };
    return { style: style };
  }

  EventDisplay = ({ event }) => (
    <div style={{height:"1.2em"}}>
      <div style={{ fontSize: ".7em" }}>{event.event}</div>
    </div>
  );


  getMonthName() {
    var d = new Date();
    var month = new Array();
    month[0] = "January";
    month[1] = "February";
    month[2] = "March";
    month[3] = "April";
    month[4] = "May";
    month[5] = "June";
    month[6] = "July";
    month[7] = "August";
    month[8] = "September";
    month[9] = "October";
    month[10] = "November";
    month[11] = "December";
    return month[d.getMonth()];
  }

  render() {
    const { classes } = this.props;
    const date = new Date();

    return (
      <Template active={"schedule"} title={"Events"}>
        <Title color={"blue"}>All Events</Title>
        <div style={{ textAlign: "center" }}>
          <CustomButton href={"/events/add-new-event"} text={"ADD NEW EVENT"}
                        style={{ marginTop: 20, marginBottom: 25 }} color={"orange"} size={"large"}/>
        </div>
        {Object.keys(this.state.displayEvents).length > 0 &&
        <div style={{ marginBottom: "5%" }}>
          <h3 style={{ textAlign: "left", color: "#F1945B", fontSize: "20px", fontWeight: 100 }}> {this.getMonthName()} {date.getFullYear()}</h3>
          <div style={{ color: "#F1945B", backgroundColor: "#F1945B", height: 3 }}/>
          {Object.keys(this.state.displayEvents).map((k, ind) => {
              return (
                // <ScrollableAnchor >
                <Element name={k}>
                  <EventCard ele={this.state.displayEvents[k]} key={k}/>
                </Element>
                // </ScrollableAnchor>
                );
          })}
        </div>}
        <Search placeholder="Search Events by Name and/or Tags"
                iconColor="#2984CE"
                data={this.state.data}
                ref={input => this.inputElement = input}
                onClick={(val) => { this.searchFunc(val) }}
                onCancel={() => { this.searchFunc('') }}

        /><br />
        <Calendar
          views={["month"]}
          localizer={localizer}
          scrollToTime={new Date()}
          events={this.state.myEventsList}
          defaultView={"month"}
          startAccessor="start_date"
          endAccessor="end_date"
          allDayAccessor="allDay"
          showMultiDayTimes
          style={{ height: 550, marginTop: 50 }}
          onSelectEvent={(event) => {
            this.setState({ open: true, event });
          }}
          eventPropGetter={this.eventPropStyles}
          components={{
            event: this.EventDisplay,
            toolbar: CustomToolbar
          }}
          formats={{ eventTimeRangeFormat: () => null }}
        />
        {this.state.open && <EventModal open={this.state.open} closeDo={this.closeDo} event={this.state.event}/>}
      </Template>
    );
  }
}



export default withStyles(useStyles)(Events);
